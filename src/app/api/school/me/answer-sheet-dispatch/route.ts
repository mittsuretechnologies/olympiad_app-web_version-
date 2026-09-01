import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

function getSchoolPayload(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (payload?.role !== 'SCHOOL' || !payload?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

// Lists every answer-sheet shipment this school has sent back, newest first,
// with SuperAdmin's receipt confirmation if it's been logged yet.
export async function GET(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const dispatches = await prisma.answerSheetDispatch.findMany({
      where: { schoolId: payload.id },
      orderBy: { sentAt: 'desc' },
      include: {
        classCounts: true,
        receipt: { include: { classCounts: true } },
      },
    });
    return NextResponse.json(dispatches);
  } catch (error) {
    console.error('GET school answer-sheet-dispatch failed:', error);
    return NextResponse.json({ message: 'Failed to fetch answer sheet dispatches' }, { status: 500 });
  }
}

// School logs sending answer sheets back to SuperAdmin after conducting the
// exam — the return-leg counterpart to /api/schools/[id]/paper-dispatch.
export async function POST(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sentAt, mode, trackingNo, notes, classCounts } = body;

    if (!sentAt) {
      return NextResponse.json({ message: 'Sent date is required' }, { status: 400 });
    }
    if (!Array.isArray(classCounts) || classCounts.length === 0) {
      return NextResponse.json({ message: 'At least one class count is required' }, { status: 400 });
    }

    const rows: { className: string; count: number }[] = [];
    for (const c of classCounts) {
      const className = String(c?.className || '').trim();
      const count = parseInt(String(c?.count ?? '0'), 10);
      if (!className) return NextResponse.json({ message: 'Class name is required for every row' }, { status: 400 });
      if (!count || count < 1) return NextResponse.json({ message: `Enter a valid count for ${className}` }, { status: 400 });
      rows.push({ className, count });
    }

    const dispatch = await prisma.answerSheetDispatch.create({
      data: {
        schoolId: payload.id,
        sentAt: new Date(sentAt),
        mode: mode || null,
        trackingNo: trackingNo || null,
        notes: notes || null,
        classCounts: { create: rows },
      },
      include: { classCounts: true },
    });

    return NextResponse.json(dispatch);
  } catch (error) {
    console.error('POST school answer-sheet-dispatch failed:', error);
    return NextResponse.json({ message: 'Failed to log answer sheet dispatch' }, { status: 500 });
  }
}
