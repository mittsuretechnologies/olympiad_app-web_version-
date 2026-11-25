import { prisma } from '@/lib/prisma';
import { getResultOverview } from '@/lib/result-overview';

// Showing students' passports to them in the mittmee app, for any selection of
// students at once. Two gates, both needed for the app to return a passport:
//   1. SuperAdmin has released the school's passports to the school (PassportRelease)
//   2. SuperAdmin or the school has shown THIS student's passport (StudentPassportRelease)
// Withdrawing from the school hides every one of them again, without losing
// which students had been shown — re-releasing brings them back.
//
// Reads tolerate the StudentPassportRelease table not existing yet (migration
// not applied): everything reads as "not shown".

/** Olympiad code → when it was shown in the app, for the given codes. */
export async function shownInApp(codes: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (codes.length === 0) return out;
  try {
    const rows = await prisma.studentPassportRelease.findMany({
      where: { olympiadCode: { in: codes } },
      select: { olympiadCode: true, releasedAt: true },
    });
    for (const r of rows) out.set(r.olympiadCode, r.releasedAt);
  } catch (err) {
    console.warn('StudentPassportRelease unavailable', err);
  }
  return out;
}

export interface ShowResult {
  /** Code → since when it is shown (newly shown or already shown). */
  shown: Record<string, Date>;
  /** Codes that could not be shown, with the reason. */
  skipped: { olympiadCode: string; reason: string }[];
}

/**
 * Show the selected students' passports in the app. `onlySchoolDbId`
 * (School.id) limits it to that school's own students — set for a school,
 * unset for SuperAdmin. A code is skipped when it is not a student (of that
 * school), the school has not been released the passports, or the passport is
 * not Complete.
 */
export async function showInApp(
  codes: string[],
  by: { id: string | null; role: 'ADMIN' | 'SCHOOL' },
  onlySchoolDbId?: string,
): Promise<ShowResult> {
  const skipped: ShowResult['skipped'] = [];
  const allocs = await prisma.olympiadIdAllocation.findMany({
    where: { code: { in: codes }, assignedAt: { not: null }, ...(onlySchoolDbId ? { schoolId: onlySchoolDbId } : {}) },
    select: { code: true, schoolId: true, school: { select: { schoolId: true } } },
  });
  const allocByCode = new Map(allocs.map(a => [a.code, a]));
  for (const c of codes) if (!allocByCode.has(c)) skipped.push({ olympiadCode: c, reason: 'Student not found' });

  // Group by school: one release check and one overview per school.
  const bySchool = new Map<string, { schoolCode: string; codes: string[] }>();
  for (const a of allocs) {
    const g = bySchool.get(a.schoolId) || { schoolCode: a.school.schoolId, codes: [] };
    g.codes.push(a.code);
    bySchool.set(a.schoolId, g);
  }
  const released = new Set(
    (await prisma.passportRelease.findMany({ where: { schoolId: { in: Array.from(bySchool.keys()) } }, select: { schoolId: true } }).catch(() => []))
      .map(r => r.schoolId),
  );

  const toCreate: { olympiadCode: string; schoolId: string; releasedBy: string | null; releasedByRole: string }[] = [];
  for (const [schoolDbId, g] of bySchool) {
    if (!released.has(schoolDbId)) {
      for (const c of g.codes) skipped.push({ olympiadCode: c, reason: 'Passports are not released to the school yet' });
      continue;
    }
    const overview = await getResultOverview(g.schoolCode, 'manual');
    const complete = new Set((overview?.rows ?? []).filter(r => r.status === 'Complete').map(r => r.olympiadCode));
    for (const c of g.codes) {
      if (complete.has(c)) toCreate.push({ olympiadCode: c, schoolId: schoolDbId, releasedBy: by.id, releasedByRole: by.role });
      else skipped.push({ olympiadCode: c, reason: 'Passport is not ready yet' });
    }
  }

  if (toCreate.length) await prisma.studentPassportRelease.createMany({ data: toCreate, skipDuplicates: true });
  const since = await shownInApp(toCreate.map(r => r.olympiadCode));
  return { shown: Object.fromEntries(since), skipped };
}

/** Hide the selected students' passports from the app again. */
export async function hideFromApp(codes: string[], onlySchoolDbId?: string): Promise<number> {
  const r = await prisma.studentPassportRelease.deleteMany({
    where: { olympiadCode: { in: codes }, ...(onlySchoolDbId ? { schoolId: onlySchoolDbId } : {}) },
  });
  return r.count;
}

/** Reads `{ olympiadCodes: string[] }` from a JSON body (at most 1000, de-duplicated). */
export async function readOlympiadCodes(request: Request): Promise<string[]> {
  const body = await request.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body?.olympiadCodes) ? body.olympiadCodes : [];
  const codes = raw.filter((c): c is string => typeof c === 'string').map(c => c.trim()).filter(Boolean);
  return Array.from(new Set(codes)).slice(0, 1000);
}
