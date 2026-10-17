import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';
import { recordAccessLog } from '@/lib/audit-log';
import { CLASSES } from '@/lib/classes';

// Class rows in CLASSES order (Nursery → LKG → UKG); unknown/missing class last.
const classRank = (name: string) => {
  const i = CLASSES.findIndex((c) => c.name === name);
  return i === -1 ? CLASSES.length : i;
};

export async function GET(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN', 'REVIEWER', 'EVALUATOR', 'MODERATOR']);
  if (error) return error;
  const moduleCheck = await requireModule(payload, 'reports.schools', request);
  if (moduleCheck.error) return moduleCheck.error;
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        schoolId: true,
        olympiadId: true,
        name: true,
        city: true,
        state: true,
        district: true,
        contactPerson: true,
        phone: true,
        email: true,
        createdAt: true,
        olympiadIds: {
          select: {
            code: true,
            className: true,
            assignedName: true,
            student: {
              select: { id: true, isVerified: true, lastLoginAt: true },
            },
          },
        },
      },
    });

    // Fetch all AppUsers whose olympiadId matches any allocation code. Any
    // linked account makes the ID allotted; only verified ones count as registered.
    const allCodes = schools.flatMap(s => s.olympiadIds.map(o => o.code));
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: allCodes } },
      select: { olympiadId: true, isVerified: true, lastLoginAt: true },
    });
    const appUserByCode = new Map(appUsers.filter(u => u.isVerified).map(u => [u.olympiadId!, u]));
    const linkedCodes = new Set(appUsers.map(u => u.olympiadId!));
    // Logged in = the student actually used their credentials: a login was
    // recorded on the web Student row or on the linked app account. Logins are
    // only recorded since lastLoginAt was added, so older-only logins don't show.
    const loggedInCodes = new Set(appUsers.filter(u => u.lastLoginAt).map(u => u.olympiadId!));

    const result = schools.map(s => {
      const allocated = s.olympiadIds.length;

      let registered = 0;
      let verified = 0;
      let allotted = 0;
      let loggedIn = 0;
      const byClass = new Map<string, { className: string; generated: number; allotted: number; registered: number; loggedIn: number }>();

      for (const o of s.olympiadIds) {
        const hasWebStudent = o.student !== null;
        const hasAppUser = appUserByCode.has(o.code);
        const isRegistered = hasWebStudent || hasAppUser;
        // Same rule that locks an ID against deletion (api/schools/[id]/olympiad-ids).
        const isAllotted = isRegistered || !!o.assignedName || linkedCodes.has(o.code);

        const isLoggedIn = !!o.student?.lastLoginAt || loggedInCodes.has(o.code);

        if (isRegistered) registered++;
        if (isAllotted) allotted++;
        if (isLoggedIn) loggedIn++;
        if (o.student?.isVerified || (hasAppUser && appUserByCode.get(o.code)?.isVerified)) verified++;

        const key = o.className || '';
        const row = byClass.get(key) ?? { className: key, generated: 0, allotted: 0, registered: 0, loggedIn: 0 };
        row.generated++;
        if (isAllotted) row.allotted++;
        if (isRegistered) row.registered++;
        if (isLoggedIn) row.loggedIn++;
        byClass.set(key, row);
      }
      const classes = [...byClass.values()].sort((a, b) => classRank(a.className) - classRank(b.className));

      return {
        id: s.id,
        schoolId: s.schoolId,
        olympiadId: s.olympiadId,
        name: s.name,
        city: s.city,
        state: s.state,
        district: s.district,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        createdAt: s.createdAt,
        allocated,
        registered,
        verified,
        allotted,
        loggedIn,
        classes,
      };
    });

    // Contact person's name, phone and email for each school.
    await recordAccessLog(payload, {
      action: 'USER_DETAILS_VIEWED', entityType: 'School', subjectIds: result.map((s) => s.id), request,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET reports/schools failed:', error);
    return NextResponse.json({ message: 'Failed to fetch', error: error?.message }, { status: 500 });
  }
}
