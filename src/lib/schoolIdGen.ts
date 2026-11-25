import { prisma } from '@/lib/prisma';

// Next School ID (MITT001, MITT002 ... MITT999, MITT1000, MITT1001 ...).
// The max is taken numerically: sorting the text would put "MITT999" above
// "MITT1000" and keep handing out MITT1000 again once 1000 schools exist.
export async function generateSchoolId(): Promise<string> {
  const rows = await prisma.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("schoolId" FROM 5) AS INTEGER)) AS max
    FROM "public"."School"
    WHERE "schoolId" ~ '^MITT[0-9]+$'
  `;
  const lastNum = Number(rows[0]?.max ?? 0) || 0;
  return `MITT${String(lastNum + 1).padStart(3, '0')}`;
}
