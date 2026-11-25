import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/coins/appAuth';
import { getResultOverview } from '@/lib/result-overview';
import { shownInApp } from '@/lib/passport-student-release';

export const dynamic = 'force-dynamic';

// GET /api/app/passport — the signed-in student's own Holistic Progress
// Passport: the very same row the SuperAdmin Result page builds the web
// passport from (reviewer/manual exam marks, the page's default).
// Hidden (released: false, passport: null) until the school's passports have
// been released to the school AND this student's passport has been shown in
// the app — per student, by SuperAdmin on the Result page or by the school on
// its Student Passports page. Only a Complete passport is ever returned.
export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    const me = await prisma.appUser.findUnique({ where: { id: userId }, select: { olympiadId: true } });
    if (!me?.olympiadId) return NextResponse.json({ eligible: false, released: false, passport: null });

    const alloc = await prisma.olympiadIdAllocation.findUnique({
      where: { code: me.olympiadId },
      select: { school: { select: { id: true, schoolId: true } } },
    });
    const school = alloc?.school;
    if (!school?.schoolId) return NextResponse.json({ eligible: true, released: false, passport: null });

    const [schoolRelease, inApp] = await Promise.all([
      prisma.passportRelease.findUnique({ where: { schoolId: school.id }, select: { id: true } }).catch(() => null),
      shownInApp([me.olympiadId]),
    ]);
    if (!schoolRelease || !inApp.has(me.olympiadId)) return NextResponse.json({ eligible: true, released: false, passport: null });

    const overview = await getResultOverview(school.schoolId, 'manual', me.olympiadId);
    // The app account's own row (it also carries the profile photo); fall back
    // to the web-registered row for the same Olympiad ID.
    const rows = overview?.rows ?? [];
    const row = rows.find(r => r.studentKey === userId) ?? rows.find(r => r.olympiadCode === me.olympiadId) ?? null;
    const passport = row && row.status === 'Complete' ? row : null;
    return NextResponse.json({ eligible: true, released: true, passport });
  } catch (err: any) {
    console.error('GET app/passport failed:', err);
    return NextResponse.json({ message: 'Failed to load passport' }, { status: 500 });
  }
}
