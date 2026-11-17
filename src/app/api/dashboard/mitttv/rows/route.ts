import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { clearMittTvCache } from '@/lib/mittTv';
import {
  CREATABLE_KINDS, cleanRowSettings, cleanRowSubtitle, cleanRowTitle, isRowStyle,
} from '@/lib/mittTvShared';

export const dynamic = 'force-dynamic';

// POST /api/dashboard/mitttv/rows — adds a row to the MittTV screen (at the
// end): { kind: CURATED | MOST_WATCHED | NEW, title, subtitle?, style?, settings? }.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    if (!(CREATABLE_KINDS as string[]).includes(body?.kind)) {
      return NextResponse.json({ message: 'Choose what the row shows' }, { status: 400 });
    }
    const title = cleanRowTitle(body?.title);
    if (!title) return NextResponse.json({ message: 'The row needs a title' }, { status: 400 });
    const last = await prisma.mittTvRow.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const row = await prisma.mittTvRow.create({
      data: {
        kind: body.kind,
        title,
        subtitle: cleanRowSubtitle(body?.subtitle),
        style: isRowStyle(body?.style) ? body.style : body.kind === 'MOST_WATCHED' ? 'TOP10' : 'LANDSCAPE',
        settings: cleanRowSettings(body.kind, body?.settings) as object,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    clearMittTvCache();
    return NextResponse.json(
      { ...row, settings: cleanRowSettings(row.kind, row.settings), videoIds: [], autoIds: null },
      { status: 201 },
    );
  } catch (e: any) {
    console.error('mitttv row create error:', e);
    return NextResponse.json({ message: e.message || 'Could not add the row' }, { status: 500 });
  }
}

// PUT /api/dashboard/mitttv/rows — new order: { order: [rowId…] }. The banner
// always stays on top in the app whatever its place in the list.
export async function PUT(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const order: string[] = Array.isArray(body?.order) ? body.order.filter((x: unknown) => typeof x === 'string') : [];
    if (order.length === 0) return NextResponse.json({ message: 'order must list the rows' }, { status: 400 });
    await prisma.$transaction(order.map((id, i) => prisma.mittTvRow.updateMany({ where: { id }, data: { sortOrder: i } })));
    clearMittTvCache();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not save the order' }, { status: 500 });
  }
}
