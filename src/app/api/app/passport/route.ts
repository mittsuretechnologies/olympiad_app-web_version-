import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/coins/appAuth';
import { getResultOverview } from '@/lib/result-overview';

export const dynamic = 'force-dynamic';

// GET /api/app/passport — the signed-in student's own Holistic Progress
// Passport: the very same row the SuperAdmin Result page builds the web
// passport from (reviewer/manual exam marks, the page's default).
// Not gated by a release yet — school/SuperAdmin hand-off comes later.
export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    const me = await prisma.appUser.findUnique({ where: { id: userId }, select: { olympiadId: true } });
    if (!me?.olympiadId) return NextResponse.json({ eligible: false, passport: null });

    const alloc = await prisma.olympiadIdAllocation.findUnique({
      where: { code: me.olympiadId },
      select: { school: { select: { schoolId: true } } },
    });
    const schoolCode = alloc?.school?.schoolId;
    if (!schoolCode) return NextResponse.json({ eligible: true, passport: null });

    const overview = await getResultOverview(schoolCode, 'manual', me.olympiadId);
    // The app account's own row (it also carries the profile photo); fall back
    // to the web-registered row for the same Olympiad ID.
    const rows = overview?.rows ?? [];
    const passport = rows.find(r => r.studentKey === userId) ?? rows.find(r => r.olympiadCode === me.olympiadId) ?? null;
    return NextResponse.json({ eligible: true, passport });
  } catch (err: any) {
    console.error('GET app/passport failed:', err);
    return NextResponse.json({ message: 'Failed to load passport' }, { status: 500 });
  }
}
