import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Combined "last active" view across every account type in this schema:
//   - Student: registered through a school's Olympiad enrollment, logs in
//     with an olympiadCode + password (api/auth/student-login). Always an
//     Olympiad account by definition.
//   - AppUser: mobile app account. Carrying an olympiadId makes it an
//     Olympiad account; without one it's a general (viewer) account.
// A school-registered Student and their AppUser login are genuinely separate
// rows, linked only via olympiadId, so both are returned as distinct entries
// rather than merged into one.
//
// Every AppUser is returned — the olympiadId filter that used to exclude
// general users is gone, since the report now splits on Olympiad vs General
// rather than hiding one of them. `accountKind` carries that split to the
// client so it doesn't have to re-derive it from identifier shape.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const [students, appUsers] = await Promise.all([
      prisma.student.findMany({
        select: {
          id: true,
          name: true,
          olympiadCode: true,
          phone: true,
          lastLoginAt: true,
          createdAt: true,
          allocation: {
            select: { school: { select: { name: true, city: true, state: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appUser.findMany({
        select: {
          id: true,
          userId: true,
          olympiadId: true,
          mobile: true,
          email: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Resolve school for the AppUser rows the same way api/app/login does —
    // via their olympiadId's OlympiadIdAllocation, since AppUser has no
    // direct school relation of its own.
    const olympiadCodes = [...new Set(appUsers.map(u => u.olympiadId).filter(Boolean))] as string[];
    const allocations = olympiadCodes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where:  { code: { in: olympiadCodes } },
          select: { code: true, school: { select: { name: true, city: true, state: true } } },
        })
      : [];
    const schoolByCode = new Map(allocations.map(a => [a.code, a.school]));

    const rows = [
      ...students.map(s => ({
        id:          s.id,
        type:        'STUDENT' as const,
        // A Student row only exists via a school's Olympiad enrollment, so
        // there is no general-user variant of it.
        accountKind: 'OLYMPIAD' as const,
        name:        s.name,
        identifier:  s.olympiadCode,
        contact:     s.phone,
        schoolName:  s.allocation?.school?.name ?? null,
        city:        s.allocation?.school?.city ?? null,
        state:       s.allocation?.school?.state ?? null,
        lastLoginAt: s.lastLoginAt,
        createdAt:   s.createdAt,
      })),
      ...appUsers.map(u => {
        const school = u.olympiadId ? schoolByCode.get(u.olympiadId) : null;
        return {
          id:          u.id,
          type:        'APP_USER' as const,
          // The olympiadId is the whole distinction: with one, this account
          // belongs to an enrolled Olympiad student; without, it's a general
          // app user who signed up on their own.
          accountKind: (u.olympiadId ? 'OLYMPIAD' : 'GENERAL') as 'OLYMPIAD' | 'GENERAL',
          name:        u.userId,
          // General users have no Olympiad code — fall back to their own
          // userId so the column is never blank.
          identifier:  u.olympiadId ?? u.userId,
          // A general user may have signed up with either a mobile or an
          // email, so show whichever exists rather than a blank cell.
          contact:     u.mobile ?? u.email,
          schoolName:  school?.name ?? null,
          city:        school?.city ?? null,
          state:       school?.state ?? null,
          lastLoginAt: u.lastLoginAt,
          createdAt:   u.createdAt,
        };
      }),
    ];

    // Most recently active first; never-logged-in rows (lastLoginAt null)
    // sort after everyone who has, ordered among themselves by signup date.
    rows.sort((a, b) => {
      if (a.lastLoginAt && b.lastLoginAt) return +new Date(b.lastLoginAt) - +new Date(a.lastLoginAt);
      if (a.lastLoginAt) return -1;
      if (b.lastLoginAt) return 1;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('student-activity GET error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
