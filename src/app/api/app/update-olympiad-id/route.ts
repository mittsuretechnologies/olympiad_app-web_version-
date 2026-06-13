import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { olympiadId } = await request.json();

    if (!olympiadId || typeof olympiadId !== 'string') {
      return NextResponse.json({ message: 'Olympiad ID is required' }, { status: 400 });
    }

    const code = olympiadId.trim().toUpperCase();

    // Verify the olympiadId exists and is allocated (belongs to a real student slot)
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code },
    });

    if (!allocation) {
      return NextResponse.json(
        { message: 'Invalid Olympiad ID. Please check and try again.' },
        { status: 404 }
      );
    }

    // Check if another AppUser already claimed this olympiadId
    const existing = await prisma.appUser.findFirst({
      where: {
        olympiadId: code,
        NOT: { id: appUser.id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'This Olympiad ID is already linked to another account.' },
        { status: 409 }
      );
    }

    // Once the user has uploaded any olympiad evaluation video, the ID is locked
    const currentUser = await prisma.appUser.findUnique({
      where: { id: appUser.id },
      select: { olympiadId: true },
    });
    if (currentUser?.olympiadId && currentUser.olympiadId !== code) {
      const hasOlympiadVideo = await prisma.video.findFirst({
        where: { appUserId: appUser.id, isEvaluation: true },
      });
      if (hasOlympiadVideo) {
        return NextResponse.json(
          { message: 'Olympiad ID cannot be changed after submitting an Olympiad video.' },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.appUser.update({
      where: { id: appUser.id },
      data: { olympiadId: code },
      select: { id: true, userId: true, olympiadId: true },
    });

    return NextResponse.json({
      message: 'Olympiad ID saved successfully',
      user: updated,
    });
  } catch (error: any) {
    console.error('update-olympiad-id error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
