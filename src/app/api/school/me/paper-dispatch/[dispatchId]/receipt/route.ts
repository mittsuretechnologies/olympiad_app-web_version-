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

// Logs the school's confirmation of what actually arrived for one dispatch —
// date received, per-class counts, and an optional discrepancy note if it
// doesn't match what SuperAdmin logged as sent. One receipt per dispatch;
// re-submitting overwrites the school's own prior entry (mistakes happen
// before the count is final, same allowance the attendance flow gives).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dispatchId: string }> }
) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { dispatchId } = await params;
    const body = await request.json();
    const { receivedAt, discrepancyNote, classCounts } = body;

    if (!receivedAt) {
      return NextResponse.json({ message: 'Received date is required' }, { status: 400 });
    }
    if (!Array.isArray(classCounts) || classCounts.length === 0) {
      return NextResponse.json({ message: 'At least one class count is required' }, { status: 400 });
    }

    const rows: { className: string; count: number }[] = [];
    for (const c of classCounts) {
      const className = String(c?.className || '').trim();
      const count = parseInt(String(c?.count ?? '0'), 10);
      if (!className) return NextResponse.json({ message: 'Class name is required for every row' }, { status: 400 });
      if (count < 0 || isNaN(count)) return NextResponse.json({ message: `Enter a valid count for ${className}` }, { status: 400 });
      rows.push({ className, count });
    }

    const dispatch = await prisma.paperDispatch.findUnique({
      where: { id: dispatchId },
      select: { schoolId: true },
    });
    if (!dispatch || dispatch.schoolId !== payload.id) {
      return NextResponse.json({ message: 'Dispatch not found for this school' }, { status: 404 });
    }

    const receipt = await prisma.$transaction(async (tx) => {
      await tx.paperReceipt.deleteMany({ where: { dispatchId } });
      return tx.paperReceipt.create({
        data: {
          dispatchId,
          schoolId: payload.id,
          receivedAt: new Date(receivedAt),
          discrepancyNote: discrepancyNote || null,
          classCounts: { create: rows },
        },
        include: { classCounts: true },
      });
    });

    return NextResponse.json(receipt);
  } catch (error) {
    console.error('POST paper-dispatch receipt failed:', error);
    return NextResponse.json({ message: 'Failed to log receipt' }, { status: 500 });
  }
}
