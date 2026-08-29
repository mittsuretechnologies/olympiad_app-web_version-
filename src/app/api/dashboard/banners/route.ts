import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const banners = await prisma.bannerSlide.findMany({
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
    const { desktopImage, mobileImage, alt } = await request.json();
    if (!desktopImage?.trim()) {
      return NextResponse.json({ message: 'Desktop image is required' }, { status: 400 });
    }

    const last = await prisma.bannerSlide.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    const nextOrder = (last?.order ?? -1) + 1;

    const banner = await prisma.bannerSlide.create({
      data: {
        desktopImage: desktopImage.trim(),
        mobileImage: mobileImage?.trim() || null,
        alt: alt?.trim() || '',
        order: nextOrder,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
