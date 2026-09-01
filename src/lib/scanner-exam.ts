import { prisma } from '@/lib/prisma';
import { normalizeKoshKey, type AnyKoshKey } from '@/lib/kosh';

export interface ExamQuestionResult {
  questionNumber: number;
  pageNumber: number;
  questionText: string | null;
  questionType: string | null;
  maxMarks: number;
  aiMarks: number | null;
  aiConfidence: number | null;
  manualMarks: number | null;
  manualMarksDisplay: string | null;
  reviewedBy: string | null;
  // "Effective" score: manual marks when a human has reviewed this question,
  // otherwise the AI's — mirrors how the scanner's own audit view treats it.
  score: number | null;
  percentage: number | null;
  // AI and manual kosha breakdowns are independent — a reviewer can re-weight
  // a question's koshas, not just its marks — so both are kept separate
  // rather than one "effective" set.
  aiKoshas: { kosha: string; earned: number; weight: number }[];
  manualKoshas: { kosha: string; earned: number; weight: number }[];
}

export interface ExamResult {
  studentId: string;
  // Effective total — manual marks where reviewed, AI marks otherwise; matches
  // scanner.sheet_results.total_score, which is what the scanner itself reports.
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  // Pure AI-only and pure-manual-only totals, each summed across just the
  // questions that actually have that kind of mark (manual is often partial).
  aiTotalScore: number;
  aiMaxScore: number;
  manualTotalScore: number | null;
  manualMaxScore: number;
  manualQuestionCount: number;
  // Per-kosha % computed purely from AI marks, and purely from manual marks
  // (each aggregated across all questions carrying that kind of mark) — lets
  // callers pick which one drives the holistic score, independent of which
  // one the scanner itself currently prefers as "effective".
  aiKoshPercents: Partial<Record<AnyKoshKey, number>>;
  manualKoshPercents: Partial<Record<AnyKoshKey, number>>;
  questions: ExamQuestionResult[];
}

// Sums earned/weight per kosha across a set of {kosha, earned, weight}
// entries (e.g. every question's aiKoshas), then converts each to a %.
function aggregateKoshPercents(
  entries: { kosha: string; earned: number; weight: number }[]
): Partial<Record<AnyKoshKey, number>> {
  const totals = new Map<AnyKoshKey, { earned: number; weight: number }>();
  for (const e of entries) {
    const key = normalizeKoshKey(e.kosha);
    if (!key) continue;
    const t = totals.get(key) ?? { earned: 0, weight: 0 };
    t.earned += e.earned;
    t.weight += e.weight;
    totals.set(key, t);
  }
  const percents: Partial<Record<AnyKoshKey, number>> = {};
  for (const [key, t] of totals) {
    percents[key] = t.weight ? Math.round((t.earned / t.weight) * 1000) / 10 : 0;
  }
  return percents;
}

interface SheetResultRow {
  student_id: string;
  sheet_id: string;
  sheet_uuid: string;
  total_score: number;
  max_total_score: number;
  percentage: number;
  score_breakdown: {
    per_kosha?: Record<string, { earned: number; possible: number; percentage: number }>;
  } | null;
}

interface AiMarksRow {
  sheet_uuid: string;
  question_number: number;
  page_number: number;
  question_text: string | null;
  question_type: string | null;
  max_marks: number;
  ai_marks: number | null;
  ai_confidence: number | null;
  ai_panchakosha: { kosha: string; earned: number; weight: number }[] | null;
}

interface ManualMarksRow {
  sheet_uuid: string;
  question_number: number;
  manual_marks: number | null;
  manual_marks_display: string | null;
  reviewed_by: string | null;
  manual_panchakosha: { kosha: string; earned: number; weight: number }[] | null;
}

// scanner.ai_marks only exposes question_text on scanner deployments new
// enough to have the column — production has it, older/staging copies of the
// schema don't, and selecting it there fails the whole query with a 42703
// rather than just returning null. Probe once per process and fall back to
// omitting the column, so pointing DATABASE_URL at an older scanner schema
// degrades to "Question N" instead of 500ing the results page.
let questionTextSupported: Promise<boolean> | null = null;
function hasQuestionTextColumn(): Promise<boolean> {
  questionTextSupported ??= prisma
    .$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM information_schema.columns
      WHERE table_schema = 'scanner'
        AND table_name = 'ai_marks'
        AND column_name = 'question_text'
    `
    .then(rows => (rows[0]?.n ?? 0) > 0)
    .catch(() => false);
  return questionTextSupported;
}

// The scanner app (a separate Python/Celery service) shares this Postgres
// instance and writes exam results to the `scanner` schema, which isn't
// modeled in Prisma. Its `sheets.student_id` is NOT this app's Student.id —
// in practice every sheet's student_id is actually an AppUser.id (students
// currently only reach the scanner via the app-registration flow, which has
// no Student row at all). So callers must pass the id each group is really
// keyed by — Student.id for web-source groups, AppUser.id for app-source —
// and this just matches sheets.student_id against whatever it's given.
export async function getLatestExamResults(studentIds: string[]): Promise<Map<string, ExamResult>> {
  if (studentIds.length === 0) return new Map();

  // Overall totals and per-kosha % still come from sheet_results — it's the
  // one place the scanner pre-aggregates a sheet's full score.
  const sheetRows = await prisma.$queryRaw<SheetResultRow[]>`
    SELECT DISTINCT ON (sh.student_id)
      sh.student_id,
      sh.id AS sheet_id,
      sh.sheet_uuid,
      sr.total_score,
      sr.max_total_score,
      sr.percentage,
      sr.score_breakdown
    FROM scanner.sheet_results sr
    JOIN scanner.sheets sh ON sh.id = sr.sheet_id
    WHERE sh.student_id = ANY(${studentIds})
    ORDER BY sh.student_id, sr.generated_at DESC NULLS LAST
  `;
  if (sheetRows.length === 0) return new Map();

  // ai_marks/manual_marks are keyed by scanner.sheets.sheet_uuid — a
  // different column from sheets.id despite the similar name — so join on
  // that, not on the sheet's own primary key.
  const sheetUuids = sheetRows.map(r => r.sheet_uuid);

  // Per-question detail — question text, AI marks/confidence/kosha weights —
  // comes straight from the scanner's own ai_marks view.
  const questionText = (await hasQuestionTextColumn()) ? 'question_text' : 'NULL::text AS question_text';
  const aiRows = await prisma.$queryRawUnsafe<AiMarksRow[]>(
    `SELECT sheet_uuid, question_number, page_number, ${questionText}, question_type,
            max_marks, ai_marks, ai_confidence, ai_panchakosha
     FROM scanner.ai_marks
     WHERE sheet_uuid = ANY($1::uuid[])`,
    sheetUuids,
  );

  // Manual (human-reviewed) marks, when a reviewer has been through this
  // question — most rows will have manual_marks = null until reviewed.
  const manualRows = await prisma.$queryRaw<ManualMarksRow[]>`
    SELECT sheet_uuid, question_number, manual_marks, manual_marks_display, reviewed_by, manual_panchakosha
    FROM scanner.manual_marks
    WHERE sheet_uuid = ANY(${sheetUuids}::uuid[])
  `;
  const manualByKey = new Map(manualRows.map(m => [`${m.sheet_uuid}:${m.question_number}`, m]));

  const questionsBySheet = new Map<string, ExamQuestionResult[]>();
  for (const q of aiRows) {
    const manual = manualByKey.get(`${q.sheet_uuid}:${q.question_number}`);
    const effectiveScore = manual?.manual_marks ?? q.ai_marks;
    const entry: ExamQuestionResult = {
      questionNumber: q.question_number,
      pageNumber: q.page_number,
      questionText: q.question_text,
      questionType: q.question_type,
      maxMarks: q.max_marks,
      aiMarks: q.ai_marks,
      aiConfidence: q.ai_confidence,
      manualMarks: manual?.manual_marks ?? null,
      manualMarksDisplay: manual?.manual_marks_display ?? null,
      reviewedBy: manual?.reviewed_by ?? null,
      score: effectiveScore,
      percentage: effectiveScore !== null && q.max_marks ? Math.round((effectiveScore / q.max_marks) * 1000) / 10 : null,
      aiKoshas: (q.ai_panchakosha || []).map(k => ({ kosha: k.kosha, earned: k.earned, weight: k.weight })),
      manualKoshas: (manual?.manual_panchakosha || []).map(k => ({ kosha: k.kosha, earned: k.earned, weight: k.weight })),
    };
    const list = questionsBySheet.get(q.sheet_uuid) ?? [];
    list.push(entry);
    questionsBySheet.set(q.sheet_uuid, list);
  }

  const result = new Map<string, ExamResult>();
  for (const row of sheetRows) {
    const questions = (questionsBySheet.get(row.sheet_uuid) || []).sort((a, b) => a.questionNumber - b.questionNumber);

    const aiTotalScore = Math.round(questions.reduce((sum, q) => sum + (q.aiMarks ?? 0), 0) * 100) / 100;
    const aiMaxScore = Math.round(questions.reduce((sum, q) => sum + q.maxMarks, 0) * 100) / 100;
    const manuallyMarked = questions.filter(q => q.manualMarks !== null);
    const manualTotalScore = manuallyMarked.length
      ? Math.round(manuallyMarked.reduce((sum, q) => sum + (q.manualMarks ?? 0), 0) * 100) / 100
      : null;
    const manualMaxScore = Math.round(manuallyMarked.reduce((sum, q) => sum + q.maxMarks, 0) * 100) / 100;

    const aiKoshPercents = aggregateKoshPercents(questions.flatMap(q => q.aiKoshas));
    const manualKoshPercents = aggregateKoshPercents(questions.flatMap(q => q.manualKoshas));

    result.set(row.student_id, {
      studentId: row.student_id,
      totalScore: row.total_score,
      maxTotalScore: row.max_total_score,
      percentage: row.percentage,
      aiTotalScore,
      aiMaxScore,
      manualTotalScore,
      manualMaxScore,
      manualQuestionCount: manuallyMarked.length,
      aiKoshPercents,
      manualKoshPercents,
      questions,
    });
  }
  return result;
}
