import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// One row per school with its LATEST answer-sheet dispatch's status, for the
// SuperAdmin answer-sheet table's Status column.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const dispatches = await prisma.answerSheetDispatch.findMany({
      orderBy: { sentAt: 'desc' },
      select: {
        schoolId: true,
        sentAt: true,
        classCounts: { select: { count: true } },
        receipt: { select: { classCounts: { select: { count: true } } } },
      },
    });

    const latestBySchool = new Map<string, (typeof dispatches)[number]>();
    for (const d of dispatches) {
      if (!latestBySchool.has(d.schoolId)) latestBySchool.set(d.schoolId, d);
    }

    const result = Array.from(latestBySchool.entries()).map(([schoolId, d]) => {
      const totalSent = d.classCounts.reduce((sum, c) => sum + c.count, 0);
      const totalReceived = d.receipt ? d.receipt.classCounts.reduce((sum, c) => sum + c.count, 0) : null;
      const status = !d.receipt
        ? 'AWAITING_CONFIRMATION'
        : totalReceived !== totalSent
        ? 'DISCREPANCY'
        : 'CONFIRMED';
      return { schoolId, sentAt: d.sentAt, status };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET answer-sheet-dispatch status failed:', error);
    return NextResponse.json({ message: 'Failed to fetch dispatch status' }, { status: 500 });
  }
}
