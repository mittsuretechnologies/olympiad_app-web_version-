import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const result = await prisma.olympiadIdAllocation.updateMany({
      where: { schoolId: id, sentAt: null },
      data: { sentAt: new Date() },
    });

    return NextResponse.json({
      sent: result.count,
      schoolId: school.schoolId,
    });
  } catch (error) {
    console.error('POST send olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to send IDs' }, { status: 500 });
  }
}
