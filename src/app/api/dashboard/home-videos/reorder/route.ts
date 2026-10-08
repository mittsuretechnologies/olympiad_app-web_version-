import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { isHomeSection } from '@/lib/homeSectionVideos';

// POST /api/dashboard/home-videos/reorder
// Body: { section: 'LEARNING' | 'PARENTING', order: string[] } — the section's
// video ids in display order. Each row's `order` becomes its index. Scoped to
// one section so a reorder can never move a video between sections.
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { section, order } = await request.json();
    if (!isHomeSection(section)) return NextResponse.json({ message: 'Invalid section' }, { status: 400 });
    if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ message: 'order must be an array of video ids' }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((id: string, index: number) =>
        prisma.homeSectionVideo.updateMany({ where: { id, section }, data: { order: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
