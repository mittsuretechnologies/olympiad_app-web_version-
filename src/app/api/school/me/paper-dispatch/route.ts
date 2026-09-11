import { NextResponse } from 'next/server';

// Paper Dispatch feature is disabled — no longer part of the product.
// Original implementation kept below (commented) in case it needs reviving.
export async function GET() {
  return NextResponse.json({ message: 'This feature is no longer available' }, { status: 410 });
}

/*
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

function getSchoolPayload(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, getJwtSecret());
    if (payload?.role !== 'SCHOOL' || !payload?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

// Lists every question-paper dispatch sent to this school (logged by
// SuperAdmin), with the school's own receipt confirmation if it has logged
// one yet — the school's own "papers received" page reads this.
export async function GET(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const dispatches = await prisma.paperDispatch.findMany({
      where: { schoolId: payload.id },
      orderBy: { sentAt: 'desc' },
      include: {
        classCounts: true,
        receipt: { include: { classCounts: true } },
      },
    });
    return NextResponse.json(dispatches);
  } catch (error) {
    console.error('GET school paper-dispatch failed:', error);
    return NextResponse.json({ message: 'Failed to fetch dispatch records' }, { status: 500 });
  }
}
*/
