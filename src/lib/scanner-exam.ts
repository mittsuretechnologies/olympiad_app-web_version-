import { prisma } from '@/lib/prisma';
import { normalizeKoshKey, type AnyKoshKey } from '@/lib/kosh';

export interface ExamResult {
  studentId: string;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  koshPercents: Partial<Record<AnyKoshKey, number>>;
}

interface SheetResultRow {
  student_id: string;
  total_score: number;
  max_total_score: number;
  percentage: number;
  score_breakdown: { per_kosha?: Record<string, { earned: number; possible: number; percentage: number }> } | null;
}

// The scanner app (a separate Python/Celery service) shares this Postgres
// instance and writes exam results to the `scanner` schema, which isn't
// modeled in Prisma — its student_id is assumed to equal this app's
// Student.id (unconfirmed; if the two don't actually align, this simply
// returns no match rather than throwing).
export async function getLatestExamResults(studentIds: string[]): Promise<Map<string, ExamResult>> {
  if (studentIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<SheetResultRow[]>`
    SELECT DISTINCT ON (sh.student_id)
      sh.student_id,
      sr.total_score,
      sr.max_total_score,
      sr.percentage,
      sr.score_breakdown
    FROM scanner.sheet_results sr
    JOIN scanner.sheets sh ON sh.id = sr.sheet_id
    WHERE sh.student_id = ANY(${studentIds})
    ORDER BY sh.student_id, sr.generated_at DESC NULLS LAST
  `;

  const result = new Map<string, ExamResult>();
  for (const row of rows) {
    const koshPercents: Partial<Record<AnyKoshKey, number>> = {};
    const perKosha = row.score_breakdown?.per_kosha || {};
    for (const [rawKey, val] of Object.entries(perKosha)) {
      const key = normalizeKoshKey(rawKey);
      if (key) koshPercents[key] = val.percentage;
    }
    result.set(row.student_id, {
      studentId: row.student_id,
      totalScore: row.total_score,
      maxTotalScore: row.max_total_score,
      percentage: row.percentage,
      koshPercents,
    });
  }
  return result;
}
