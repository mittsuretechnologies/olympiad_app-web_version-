import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { getResultOverview } from '@/lib/result-overview';

export const dynamic = 'force-dynamic';

// GET /api/school/me/passports — the school's own students' Holistic Progress
// Passports. Empty (released: false) until SuperAdmin releases them for this
// school from the Result page. Exam marks are the reviewer's (manual) ones, the
// same default the Result page opens with.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }
  if (payload?.role !== 'SCHOOL' || !payload?.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { schoolId: true, name: true } });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    // Missing table (migration not applied yet) reads the same as "not released".
    const release = await prisma.passportRelease.findUnique({ where: { schoolId: payload.id }, select: { releasedAt: true } }).catch(() => null);
    if (!release) return NextResponse.json({ released: false, releasedAt: null, students: [] });

    const overview = await getResultOverview(school.schoolId, 'manual');
    return NextResponse.json({ released: true, releasedAt: release.releasedAt, students: overview?.rows ?? [] });
  } catch (err: any) {
    console.error('GET school/me/passports failed:', err);
    return NextResponse.json({ message: 'Failed to load passports' }, { status: 500 });
  }
}
