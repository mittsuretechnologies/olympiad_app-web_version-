import { NextResponse } from 'next/server';

// Answer Sheet Dispatch feature is disabled — no longer part of the product.
// Original implementation kept below (commented) in case it needs reviving.
export async function GET() {
  return NextResponse.json({ message: 'This feature is no longer available' }, { status: 410 });
}

/*
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Lists every answer-sheet shipment logged by one school, each with its
// per-class counts and — if SuperAdmin has confirmed it — the matching
// receipt entry, newest first.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const dispatches = await prisma.answerSheetDispatch.findMany({
      where: { schoolId: id },
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
*/
