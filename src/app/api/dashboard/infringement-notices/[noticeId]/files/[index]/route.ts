import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readNoticeFile, type StoredNoticeFile } from '@/lib/infringementFiles';
import { requireSuperAdmin } from '../../../auth';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/infringement-notices/:noticeId/files/:index — streams one proof document. SuperAdmin only.
export async function GET(request: Request, { params }: { params: Promise<{ noticeId: string; index: string }> }) {
  if (!requireSuperAdmin(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId, index } = await params;
    const notice = await prisma.infringementNotice.findUnique({ where: { id: noticeId }, select: { files: true } });
    const file = ((notice?.files as unknown as StoredNoticeFile[]) || [])[Number(index)];
    if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });

    const body = await readNoticeFile(file);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${file.name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('GET infringement notice file failed:', error);
    return NextResponse.json({ message: 'Could not load file' }, { status: 500 });
  }
}
