import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { erpAdminOverview, ensureClassesRow, saveErpSettings } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/mitttv/erp[?refresh=1] — MittTV → Class Content: whether
// the ERP can be read, its totals, what each class and series has, and the
// display settings. refresh=1 reads the ERP again instead of the copy in memory.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const refresh = new URL(request.url).searchParams.get('refresh') === '1';
    return NextResponse.json(await erpAdminOverview(refresh));
  } catch (e: any) {
    console.error('mitttv erp overview error:', e);
    return NextResponse.json({ message: e.message || 'Could not read the class content' }, { status: 500 });
  }
}

// PATCH /api/dashboard/mitttv/erp — { enabled?, hiddenClasses?, hiddenSeries?,
// hiddenBooks? } (each list replaces the old one). Switching on the first time
// adds the "Learn by Class" row to the MittTV screen, after Continue Watching.
export async function PATCH(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await saveErpSettings(body);
    if (settings.enabled) await ensureClassesRow();
    return NextResponse.json(await erpAdminOverview());
  } catch (e: any) {
    console.error('mitttv erp settings error:', e);
    return NextResponse.json({ message: e.message || 'Could not save' }, { status: 500 });
  }
}
