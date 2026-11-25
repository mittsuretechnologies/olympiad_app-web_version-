import { NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/auth-guard';
import { hideFromApp, readOlympiadCodes, showInApp } from '@/lib/passport-student-release';

export const dynamic = 'force-dynamic';

// POST   /api/school/me/passports/student-release  { olympiadCodes: [...] }  the school shows these students' passports in the mittmee app
// DELETE /api/school/me/passports/student-release  { olympiadCodes: [...] }  the school hides them again
// Only the school's own students; only once SuperAdmin has released the passports to it.

export async function POST(request: Request) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const codes = await readOlympiadCodes(request);
    if (codes.length === 0) return NextResponse.json({ message: 'Select at least one student' }, { status: 400 });
    const result = await showInApp(codes, { id: payload.id, role: 'SCHOOL' }, payload.id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('POST school/me/passports/student-release failed:', err);
    return NextResponse.json({ message: 'Failed to show passports to students' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const codes = await readOlympiadCodes(request);
    if (codes.length === 0) return NextResponse.json({ message: 'Select at least one student' }, { status: 400 });
    const hidden = await hideFromApp(codes, payload.id);
    return NextResponse.json({ hidden });
  } catch (err: any) {
    console.error('DELETE school/me/passports/student-release failed:', err);
    return NextResponse.json({ message: 'Failed to hide passports from students' }, { status: 500 });
  }
}
