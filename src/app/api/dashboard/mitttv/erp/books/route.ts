import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { erpAdminBooks } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/mitttv/erp/books?class=5[&series=<id>] — the ERP's books of
// a class, read live, with their chapter / video counts.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const sp = new URL(request.url).searchParams;
    return NextResponse.json({ books: await erpAdminBooks(sp.get('class') || '', sp.get('series')) });
  } catch (e: any) {
    console.error('mitttv erp books error:', e);
    return NextResponse.json({ message: e.message || 'Could not read the ERP' }, { status: 503 });
  }
}
