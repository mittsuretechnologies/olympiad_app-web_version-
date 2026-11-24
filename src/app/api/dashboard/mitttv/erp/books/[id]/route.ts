import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { erpAdminBook } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/mitttv/erp/books/:id — one ERP book with every chapter and
// its video links (played from the ERP server), for the dashboard preview.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const { id } = await params;
    const data = await erpAdminBook(id);
    if (!data) return NextResponse.json({ message: 'Book not found in the ERP' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('mitttv erp book error:', e);
    return NextResponse.json({ message: e.message || 'Could not read the ERP' }, { status: 503 });
  }
}
