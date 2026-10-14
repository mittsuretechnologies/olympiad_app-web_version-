// Server-side CRM ID checks. The CRM number is the Olympiad ID prefix (see
// lib/olympiadIdFormat), so every school needs its own: "S-72974" and "72974"
// count as the same CRM, since both become prefix 072974.

import { prisma } from '@/lib/prisma';
import { CRM_ID_FORMAT_HINT, olympiadPrefixForCrm } from '@/lib/olympiadIdFormat';

/** The other school (if any) whose CRM ID has the same number. */
export async function findSchoolWithSameCrm(prefix: string, excludeSchoolDbId?: string) {
  const rows = await prisma.$queryRaw<{ id: string; schoolId: string; name: string; olympiadId: string }[]>`
    SELECT id, "schoolId", name, "olympiadId" FROM "public"."School"
    WHERE lpad(regexp_replace("olympiadId", '\\D', '', 'g'), 6, '0') = ${prefix}
      AND id <> ${excludeSchoolDbId ?? ''}
    LIMIT 1`;
  return rows[0] ?? null;
}

/**
 * Why this CRM ID can't be saved for a school, or null if it can: wrong format,
 * or another school already has the same CRM number.
 */
export async function crmIdProblem(crmId: string, excludeSchoolDbId?: string): Promise<string | null> {
  const prefix = olympiadPrefixForCrm(crmId);
  if (!prefix) return `Invalid CRM ID "${crmId}". Use ${CRM_ID_FORMAT_HINT}.`;
  const other = await findSchoolWithSameCrm(prefix, excludeSchoolDbId);
  if (other) {
    return `CRM ID "${crmId}" is already used by ${other.name} (${other.schoolId}, CRM ${other.olympiadId}).`;
  }
  return null;
}
