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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify the video belongs to this app user
    const video = await prisma.video.findFirst({
      where: { id, appUserId: appUser.id, deletedAt: null },
      include: { evaluation: true },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Once an evaluator has submitted marks, the video is locked — deleting it would
    // let a student erase a low score and re-submit for another attempt.
    if (video.evaluation) {
      return NextResponse.json(
        { error: 'Marks have already been given for this video, so it can no longer be deleted.' },
        { status: 403 }
      );
    }

    // Soft delete — the record is retained for SuperAdmin/backend visibility;
    // it's just hidden from all normal views. Un-evaluated Olympiad slots reopen
    // automatically since slot-lock checks only look at currently active videos.
    await prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('App video delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/app/videos/:id — owner-only Olympiad public/private visibility toggle.
// Does not touch status/evaluation/marking fields.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { olympiadVisibility } = await request.json();
    if (olympiadVisibility !== 'public' && olympiadVisibility !== 'private') {
      return NextResponse.json({ error: 'olympiadVisibility must be "public" or "private"' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { id, appUserId: appUser.id, deletedAt: null },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    if (!video.isEvaluation) {
      return NextResponse.json({ error: 'Visibility toggle is only available for Olympiad videos' }, { status: 400 });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: { olympiadVisibility },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('App video visibility update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
