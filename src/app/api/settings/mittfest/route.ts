import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { getMittfestSettings, setMittfestCheckboxEnabled } from '@/lib/mittfestSettings';

export const dynamic = 'force-dynamic';

// GET / POST /api/settings/mittfest — SuperAdmin only. Shows or hides the
// "Is this video for MittFest?" checkbox on the app's upload screen.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  return NextResponse.json(await getMittfestSettings());
}

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    if (typeof body.checkboxEnabled !== 'boolean') {
      return NextResponse.json({ message: 'checkboxEnabled must be true or false' }, { status: 400 });
    }

    const before = await getMittfestSettings();
    const saved = await setMittfestCheckboxEnabled(body.checkboxEnabled);

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'MITTFEST_CHECKBOX_CHANGED',
      entityType: 'AppSetting',
      entityId: 'mittfest',
      previousValue: { checkboxEnabled: before.checkboxEnabled },
      newValue: { checkboxEnabled: saved.checkboxEnabled },
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not save' }, { status: 500 });
  }
}
