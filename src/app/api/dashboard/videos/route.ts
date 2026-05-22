import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      include: {
        student: {
          select: {
            name: true,
            olympiadCode: true,
            allocation: {
              include: {
                school: {
                  select: { name: true, city: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(videos || []);
  } catch (error: any) {
    console.error('Fetch videos error:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error for now to stop the crash
  }
}

export async function POST(request: Request) {
  try {
    const { videoId, status, rejectionReason } = await request.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }

    const video = await prisma.video.update({
      where: { id: videoId },
      data: { 
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null
      }
    });

    return NextResponse.json({ message: `Video ${status.toLowerCase()} successfully`, video });
  } catch (error) {
    console.error('Update video status error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
