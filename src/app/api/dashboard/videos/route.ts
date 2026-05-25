import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? { status }
      : undefined;

    const videos = await prisma.video.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            olympiadCode: true,
            allocation: {
              include: {
                school: {
                  select: { name: true, city: true, district: true, state: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Rewrite stored video URLs to use localhost so the web dashboard can play them.
    // Stored URLs may contain 10.0.2.2 (Android emulator alias) or any other IP —
    // replace the host part so the browser can always reach the file.
    const normalized = (videos ?? []).map(v => ({
      ...v,
      videoUrl: v.videoUrl?.replace(/^https?:\/\/[^/]+/, 'http://localhost:3000') ?? v.videoUrl,
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('Fetch videos error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { videoId, status, rejectionReason } = await request.json();

    if (!videoId || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
      },
    });

    return NextResponse.json({ message: `Video ${status.toLowerCase()} successfully`, video });
  } catch (error) {
    console.error('Update video status error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
