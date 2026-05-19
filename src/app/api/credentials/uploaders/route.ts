import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const uploaders = await prisma.uploader.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uploaderId: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        status: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json(uploaders);
  } catch (error: any) {
    console.error('GET credentials/uploaders failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch', error: error?.message },
      { status: 500 }
    );
  }
}
