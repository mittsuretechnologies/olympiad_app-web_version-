import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Body: { order: string[] } — array of BannerSlide ids in the desired display
// order. Rewrites each row's `order` field to its index in the array.
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { order } = await request.json();
    if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ message: 'order must be an array of banner ids' }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((id: string, index: number) =>
        prisma.bannerSlide.update({ where: { id }, data: { order: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
