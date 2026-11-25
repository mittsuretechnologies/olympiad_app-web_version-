import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveSchool } from '@/lib/auth-guard';
import { changeOlympiadIdClass, schoolClassChangeLock } from '@/lib/olympiad-class-change';

export const dynamic = 'force-dynamic';

// GET   /api/school/me/olympiad-ids/[code]/class  → { locked: <reason> | null }
// PATCH /api/school/me/olympiad-ids/[code]/class  { className }  correct this ID's class
// Locked once the school's passports are released or the student's video is
// evaluated (see lib/olympiad-class-change). Every change is audit-logged.

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const { code } = await params;
    const alloc = await prisma.olympiadIdAllocation.findUnique({ where: { code }, select: { schoolId: true } });
    if (!alloc || alloc.schoolId !== payload.id) return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    return NextResponse.json({ locked: await schoolClassChangeLock(code, payload.id) });
  } catch (err: any) {
    console.error('GET school olympiad-id class failed:', err);
    return NextResponse.json({ message: 'Failed to check class' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const { code } = await params;
    const body = await request.json().catch(() => ({}));
    const className = typeof body?.className === 'string' ? body.className.trim() : '';
    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { name: true, schoolId: true } });
    const result = await changeOlympiadIdClass(
      code, className,
      { id: payload.id, role: 'SCHOOL', name: school ? `${school.name} (${school.schoolId})` : null },
      { asSchool: payload.id },
    );
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('PATCH school olympiad-id class failed:', err);
    return NextResponse.json({ message: 'Failed to change class' }, { status: 500 });
  }
}
