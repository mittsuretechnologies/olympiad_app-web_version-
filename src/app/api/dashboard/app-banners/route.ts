import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const banners = await prisma.appBannerSlide.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(banners);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { image, alt, title, tag, linkUrl } = await request.json();
    if (!image?.trim()) {
      return NextResponse.json({ message: 'Image is required' }, { status: 400 });
    }

    const last = await prisma.appBannerSlide.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    const nextOrder = (last?.order ?? -1) + 1;

    const banner = await prisma.appBannerSlide.create({
      data: {
        image: image.trim(),
        alt: alt?.trim() || '',
        title: title?.trim() || '',
        tag: tag?.trim() || '',
        linkUrl: linkUrl?.trim() || '',
        order: nextOrder,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
