import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
// import { notifySchools } from '@/lib/schoolNotifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = await requireAdmin(request, 'schools.view');
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

    // if (result.count > 0) {
    //   const n = result.count;
    //   await notifySchools([id], {
    //     type: 'OLYMPIAD_IDS_ADDED',
    //     title: n === 1 ? '1 new Olympiad ID added' : `${n} new Olympiad IDs added`,
    //     message: `${n} new Olympiad ID${n === 1 ? ' has' : 's have'} been sent to your school. You can assign ${n === 1 ? 'it' : 'them'} to students from Olympiad IDs.`,
    //     link: '/school/olympiad-ids',
    //     createdBy: payload?.id ?? null,
    //   });
    // }

    return NextResponse.json({
      sent: result.count,
      schoolId: school.schoolId,
    });
  } catch (error) {
    console.error('POST send olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to send IDs' }, { status: 500 });
  }
}
