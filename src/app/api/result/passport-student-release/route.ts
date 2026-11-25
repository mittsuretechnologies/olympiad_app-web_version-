import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { hideFromApp, readOlympiadCodes, showInApp } from '@/lib/passport-student-release';

export const dynamic = 'force-dynamic';

// POST   /api/result/passport-student-release  { olympiadCodes: [...] }  show these students' passports in the mittmee app
// DELETE /api/result/passport-student-release  { olympiadCodes: [...] }  hide them again
// POST skips (and reports) any student whose school hasn't been released the
// passports or whose passport isn't Complete.

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const codes = await readOlympiadCodes(request);
    if (codes.length === 0) return NextResponse.json({ message: 'Select at least one student' }, { status: 400 });
    const result = await showInApp(codes, { id: payload?.id ?? null, role: 'ADMIN' });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('POST result/passport-student-release failed:', err);
    return NextResponse.json({ message: 'Failed to show passports to students' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const codes = await readOlympiadCodes(request);
    if (codes.length === 0) return NextResponse.json({ message: 'Select at least one student' }, { status: 400 });
    const hidden = await hideFromApp(codes);
    return NextResponse.json({ hidden });
  } catch (err: any) {
    console.error('DELETE result/passport-student-release failed:', err);
    return NextResponse.json({ message: 'Failed to hide passports from students' }, { status: 500 });
  }
}
