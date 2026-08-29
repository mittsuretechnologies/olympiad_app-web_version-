import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// SuperAdmin logs confirmation of what actually arrived against one
// AnswerSheetDispatch — one receipt per dispatch; re-submitting overwrites
// the prior confirmation, same allowance the school-side receipt flow gives.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dispatchId: string }> }
) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

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

    const dispatch = await prisma.answerSheetDispatch.findUnique({
      where: { id: dispatchId },
      select: { schoolId: true },
    });
    if (!dispatch) {
      return NextResponse.json({ message: 'Dispatch not found' }, { status: 404 });
    }

    const receipt = await prisma.$transaction(async (tx) => {
      await tx.answerSheetReceipt.deleteMany({ where: { dispatchId } });
      return tx.answerSheetReceipt.create({
        data: {
          dispatchId,
          schoolId: dispatch.schoolId,
          receivedAt: new Date(receivedAt),
          discrepancyNote: discrepancyNote || null,
          createdBy: payload?.id || null,
          classCounts: { create: rows },
        },
        include: { classCounts: true },
      });
    });

    return NextResponse.json(receipt);
  } catch (error) {
    console.error('POST answer-sheet-dispatch receipt failed:', error);
    return NextResponse.json({ message: 'Failed to log receipt' }, { status: 500 });
  }
}
