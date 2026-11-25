import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { changeOlympiadIdClass } from '@/lib/olympiad-class-change';

export const dynamic = 'force-dynamic';

// PATCH /api/schools/[id]/olympiad-ids/[code]/class  { className }
// Admin correction of an Olympiad ID's class. Unlike the school's own edit it
// is never locked (passports released / video evaluated). Audit-logged.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; code: string }> }) {
  const { payload, error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const { id, code } = await params;
    const body = await request.json().catch(() => ({}));
    const className = typeof body?.className === 'string' ? body.className.trim() : '';
    const result = await changeOlympiadIdClass(
      code, className,
      { id: payload.id, role: payload.role, name: payload.name || payload.email || null },
      { schoolDbId: id },
    );
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('PATCH admin olympiad-id class failed:', err);
    return NextResponse.json({ message: 'Failed to change class' }, { status: 500 });
  }
}
