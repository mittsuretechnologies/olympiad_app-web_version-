import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public, unauthenticated read endpoint for the marketing landing page's hero
// carousel (a separate static site with no login of its own). CORS is
// wide-open (GET-only, no cookies/credentials involved) since this only ever
// returns already-public marketing images — same trust level as the images
// themselves being served straight out of /uploads.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const banners = await prisma.bannerSlide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, desktopImage: true, mobileImage: true, alt: true, title: true, tag: true },
    });
    return NextResponse.json(banners, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error('GET public/banners failed:', e);
    return NextResponse.json({ message: 'Failed to load banners' }, { status: 500, headers: CORS_HEADERS });
  }
}
