import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Lists every question-paper dispatch logged for one school, each with its
// per-class counts and — if the school has confirmed it — the matching
// receipt entry, newest first.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const dispatches = await prisma.paperDispatch.findMany({
      where: { schoolId: id },
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

// Logs a new dispatch: SuperAdmin records that question papers were sent to
// this school, when, by what mode, and how many per class.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
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

    const school = await prisma.school.findUnique({ where: { id }, select: { id: true } });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const dispatch = await prisma.paperDispatch.create({
      data: {
        schoolId: id,
        sentAt: new Date(sentAt),
        mode: mode || null,
        trackingNo: trackingNo || null,
        notes: notes || null,
        createdBy: payload?.id || null,
        classCounts: { create: rows },
      },
      include: { classCounts: true },
    });

    return NextResponse.json(dispatch);
  } catch (error) {
    console.error('POST school paper-dispatch failed:', error);
    return NextResponse.json({ message: 'Failed to log dispatch' }, { status: 500 });
  }
}
