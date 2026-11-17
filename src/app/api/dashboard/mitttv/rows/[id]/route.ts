import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { clearMittTvCache } from '@/lib/mittTv';
import { pickedKind, setRowVideos } from '@/lib/mittTvAdmin';
import { ROW_KINDS, cleanRowSettings, cleanRowSubtitle, cleanRowTitle, isRowStyle } from '@/lib/mittTvShared';

export const dynamic = 'force-dynamic';

// PATCH /api/dashboard/mitttv/rows/:id — { title, subtitle, style, settings,
// isVisible, videoIds } (any subset). videoIds = the banner's pinned videos or
// a hand-picked row's videos, in order.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const { id } = await params;
    const row = await prisma.mittTvRow.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ message: 'Row not found' }, { status: 404 });
    const body = await request.json().catch(() => ({}));

    const data: Record<string, any> = {};
    if ('title' in body) {
      const title = cleanRowTitle(body.title);
      if (!title) return NextResponse.json({ message: 'The row needs a title' }, { status: 400 });
      data.title = title;
    }
    if ('subtitle' in body) data.subtitle = cleanRowSubtitle(body.subtitle);
    if ('style' in body) {
      if (!isRowStyle(body.style)) return NextResponse.json({ message: 'Unknown card style' }, { status: 400 });
      data.style = body.style;
    }
    if ('settings' in body) {
      data.settings = cleanRowSettings(row.kind, { ...((row.settings as object) || {}), ...(body.settings || {}) });
    }
    if ('isVisible' in body) data.isVisible = !!body.isVisible;

    if ('videoIds' in body) {
      if (!pickedKind(row.kind)) return NextResponse.json({ message: 'This row picks its own videos' }, { status: 400 });
      const problem = await setRowVideos(id, body.videoIds);
      if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    }
    const saved = Object.keys(data).length ? await prisma.mittTvRow.update({ where: { id }, data }) : row;
    clearMittTvCache();
    const items = await prisma.mittTvRowItem.findMany({
      where: { rowId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { videoId: true },
    });
    return NextResponse.json({ ...saved, settings: cleanRowSettings(saved.kind, saved.settings), videoIds: items.map((i) => i.videoId) });
  } catch (e: any) {
    console.error('mitttv row update error:', e);
    return NextResponse.json({ message: e.message || 'Could not save the row' }, { status: 500 });
  }
}

// DELETE /api/dashboard/mitttv/rows/:id — removes a row (its videos stay in
// the library). The banner and Continue Watching can only be hidden.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const { id } = await params;
    const row = await prisma.mittTvRow.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ message: 'Row not found' }, { status: 404 });
    if (ROW_KINDS.find((k) => k.key === row.kind)?.single) {
      return NextResponse.json({ message: 'This row can be hidden but not deleted' }, { status: 400 });
    }
    await prisma.mittTvRow.delete({ where: { id } });
    clearMittTvCache();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not delete the row' }, { status: 500 });
  }
}
