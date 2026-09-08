import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Combined "last active" view across the two separate student concepts in
// this schema:
//   - Student: registered through a school's Olympiad enrollment, logs in
//     with an olympiadCode + password (api/auth/student-login).
//   - AppUser: mobile app account. Only counted here when it carries an
//     olympiadId (i.e. it's a student's app account, not a plain viewer) —
//     mirrors the Student/Viewer split already used on the App Users report.
// They are genuinely different accounts (a school-registered Student and
// their AppUser login are separate rows, linked only via olympiadId), so
// both are returned as distinct entries rather than merged into one.
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
        where: { olympiadId: { not: null } },
        select: {
          id: true,
          userId: true,
          olympiadId: true,
          mobile: true,
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
          name:        u.userId,
          identifier:  u.olympiadId,
          contact:     u.mobile,
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
