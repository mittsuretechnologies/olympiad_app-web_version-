import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { STATE_CATEGORY, STATE_SUBS } from '@/lib/olympiad-categories';
import { isStateQualified, stateSlotOf } from '@/lib/state-round';

const JWT_SECRET = getJwtSecret();

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/app/state-round — whether this student unlocked the state round, and
// what to show: the app shows the category only when `qualified` is true, and
// allows an upload only when the slot is not `used`.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const me = await prisma.appUser.findUnique({ where: { id: appUser.id }, select: { olympiadId: true } });
    const code = me?.olympiadId ?? null;
    if (!code || !(await isStateQualified(code))) {
      return NextResponse.json({ qualified: false });
    }

    const webStudent = await prisma.student.findUnique({ where: { olympiadCode: code }, select: { id: true } });
    const slot = await stateSlotOf({ appUserId: appUser.id, studentId: webStudent?.id });
    return NextResponse.json({ qualified: true, category: STATE_CATEGORY, subCategories: STATE_SUBS, ...slot });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
