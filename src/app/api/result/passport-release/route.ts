import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
// import { notifySchools } from '@/lib/schoolNotifications';

export const dynamic = 'force-dynamic';

// POST   /api/result/passport-release  { schoolId: <school code> }  release the school's student passports to it
// DELETE /api/result/passport-release  { schoolId: <school code> }  withdraw them again
// The school's "Student Passports" page only shows anything while the release row exists.

async function readSchool(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body?.schoolId === 'string' ? body.schoolId.trim() : '';
  if (!code) return null;
  return prisma.school.findUnique({ where: { schoolId: code }, select: { id: true, name: true } });
}

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const school = await readSchool(request);
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });
    const already = await prisma.passportRelease.findUnique({ where: { schoolId: school.id }, select: { id: true } });
    const release = await prisma.passportRelease.upsert({
      where: { schoolId: school.id },
      create: { schoolId: school.id, releasedBy: payload?.id ?? null },
      update: {},
    });
    // // Tell the school once, when the passports first become visible to it.
    // if (!already) {
    //   await notifySchools([school.id], {
    //     type: 'PASSPORTS_RELEASED',
    //     title: 'Student passports are ready',
    //     message: "Your students' Holistic Progress Passports have been released. Open Student Passports to view them or download them as PDFs.",
    //     link: '/school/passports',
    //     createdBy: payload?.id ?? null,
    //   });
    // }
    return NextResponse.json({ releasedAt: release.releasedAt });
  } catch (err: any) {
    console.error('POST result/passport-release failed:', err);
    return NextResponse.json({ message: 'Failed to release passports' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const school = await readSchool(request);
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });
    await prisma.passportRelease.deleteMany({ where: { schoolId: school.id } });
    return NextResponse.json({ releasedAt: null });
  } catch (err: any) {
    console.error('DELETE result/passport-release failed:', err);
    return NextResponse.json({ message: 'Failed to withdraw passports' }, { status: 500 });
  }
}
