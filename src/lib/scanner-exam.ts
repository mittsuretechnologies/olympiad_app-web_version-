import { prisma } from '@/lib/prisma';
import { normalizeKoshKey, type AnyKoshKey } from '@/lib/kosh';

export interface ExamQuestionResult {
  questionNumber: number;
  pageNumber: number;
  score: number;
  maxMarks: number;
  percentage: number;
  koshas: { kosha: string; earned: number; weight: number }[];
  // question_type is a code (e.g. "circle_correct") — scanner.questions has
  // no free-text instruction column yet. Once one lands, join it in here so
  // every caller (passport, dashboard) picks it up without further changes.
  questionType: string | null;
}

export interface ExamResult {
  studentId: string;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  koshPercents: Partial<Record<AnyKoshKey, number>>;
  questions: ExamQuestionResult[];
}

interface SheetResultRow {
  student_id: string;
  paper_version_id: string;
  total_score: number;
  max_total_score: number;
  percentage: number;
  score_breakdown: {
    per_kosha?: Record<string, { earned: number; possible: number; percentage: number }>;
    per_question?: {
      question_number: number;
      page_number: number;
      score: number;
      max_marks: number;
      percentage: number;
      koshas?: { kosha: string; earned: number; weight: number }[];
    }[];
  } | null;
}

interface QuestionTypeRow {
  paper_version_id: string;
  question_number: number;
  question_type: string;
}

// question_type → a readable instruction label, until scanner.questions gets
// a real free-text instruction column. Unknown/new types fall back to a
// title-cased version of the raw code so nothing renders blank.
const QUESTION_TYPE_LABELS: Record<string, string> = {
  trace_dotted_bands: 'Trace the dotted lines.',
  circle_correct: 'Circle the correct answer.',
  color_image: 'Colour the picture.',
  color_by_rule: 'Colour as indicated.',
  color_correct_picture: 'Identify and colour the correct picture.',
  missing_letter: 'Fill in the missing letter.',
};

function labelForQuestionType(type: string | null): string | null {
  if (!type) return null;
  if (QUESTION_TYPE_LABELS[type]) return QUESTION_TYPE_LABELS[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '.';
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

  const rows = await prisma.$queryRaw<SheetResultRow[]>`
    SELECT DISTINCT ON (sh.student_id)
      sh.student_id,
      sr.paper_version_id,
      sr.total_score,
      sr.max_total_score,
      sr.percentage,
      sr.score_breakdown
    FROM scanner.sheet_results sr
    JOIN scanner.sheets sh ON sh.id = sr.sheet_id
    WHERE sh.student_id = ANY(${studentIds})
    ORDER BY sh.student_id, sr.generated_at DESC NULLS LAST
  `;

  const paperVersionIds = [...new Set(rows.map(r => r.paper_version_id))];
  const questionTypeRows = paperVersionIds.length
    ? await prisma.$queryRaw<QuestionTypeRow[]>`
        SELECT paper_version_id, question_number, question_type
        FROM scanner.questions
        WHERE paper_version_id = ANY(${paperVersionIds}::uuid[])
      `
    : [];
  const typeByPaperAndQuestion = new Map(
    questionTypeRows.map(q => [`${q.paper_version_id}:${q.question_number}`, q.question_type])
  );

  const result = new Map<string, ExamResult>();
  for (const row of rows) {
    const koshPercents: Partial<Record<AnyKoshKey, number>> = {};
    const perKosha = row.score_breakdown?.per_kosha || {};
    for (const [rawKey, val] of Object.entries(perKosha)) {
      const key = normalizeKoshKey(rawKey);
      if (key) koshPercents[key] = val.percentage;
    }
    const questions: ExamQuestionResult[] = (row.score_breakdown?.per_question || [])
      .map(q => {
        const type = typeByPaperAndQuestion.get(`${row.paper_version_id}:${q.question_number}`) ?? null;
        return {
          questionNumber: q.question_number,
          pageNumber: q.page_number,
          score: q.score,
          maxMarks: q.max_marks,
          percentage: q.percentage,
          koshas: (q.koshas || []).map(k => ({ kosha: k.kosha, earned: k.earned, weight: k.weight })),
          questionType: type,
        };
      })
      .sort((a, b) => a.questionNumber - b.questionNumber);
    result.set(row.student_id, {
      studentId: row.student_id,
      totalScore: row.total_score,
      maxTotalScore: row.max_total_score,
      percentage: row.percentage,
      koshPercents,
      questions,
    });
  }
  return result;
}

export { labelForQuestionType };
