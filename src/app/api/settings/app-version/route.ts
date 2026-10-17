import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { getAppVersionSettings, setAppVersionSettings } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

// GET / POST /api/settings/app-version — SuperAdmin only. The force-update
// minimum build for the mobile app (see lib/appVersion.ts).
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  return NextResponse.json(await getAppVersionSettings());
}

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const num = (v: unknown) => (typeof v === 'number' ? v : parseInt(String(v ?? ''), 10));
    const androidMinBuild = num(body.androidMinBuild);
    const iosMinBuild = num(body.iosMinBuild);
    if (!Number.isFinite(androidMinBuild) || androidMinBuild < 0 || !Number.isFinite(iosMinBuild) || iosMinBuild < 0) {
      return NextResponse.json({ message: 'Build numbers must be 0 or a positive whole number' }, { status: 400 });
    }
    const message = String(body.message ?? '').slice(0, 300);
    const iosStoreUrl = String(body.iosStoreUrl ?? '').trim();
    if (iosStoreUrl && !/^https:\/\/apps\.apple\.com\//.test(iosStoreUrl)) {
      return NextResponse.json({ message: 'The App Store link must start with https://apps.apple.com/' }, { status: 400 });
    }
    if (iosMinBuild > 0 && !iosStoreUrl) {
      return NextResponse.json({ message: 'Add the App Store link before setting an iOS minimum' }, { status: 400 });
    }

    const before = await getAppVersionSettings();
    const saved = await setAppVersionSettings({ androidMinBuild, iosMinBuild, message, iosStoreUrl });

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'APP_MIN_VERSION_CHANGED',
      entityType: 'AppSetting',
      entityId: 'app-version',
      previousValue: { androidMinBuild: before.androidMinBuild, iosMinBuild: before.iosMinBuild },
      newValue: { androidMinBuild: saved.androidMinBuild, iosMinBuild: saved.iosMinBuild },
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not save' }, { status: 500 });
  }
}
