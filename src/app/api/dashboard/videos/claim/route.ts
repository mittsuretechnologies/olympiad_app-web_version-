import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { CLAIM_TTL_MS, CLEAR_CLAIM, claimFreeFor } from '@/lib/videoClaim';

export const dynamic = 'force-dynamic';

// POST   { videoId } -> claim (or renew) a pending video for review.
//                       409 with the reviewer's name if someone else holds it.
// DELETE { videoId } -> release the caller's own claim. Idempotent.
// See lib/videoClaim.ts for how claims lapse.

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MODERATOR']);
  if (error) return error;

  try {
    const { videoId } = await request.json().catch(() => ({}));
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ message: 'videoId required' }, { status: 400 });
    }

    const now = new Date();
    // Atomic: only succeeds if the video is still pending and nobody else holds
    // a live claim — two moderators clicking the same video at the same moment
    // can't both win.
    const result = await prisma.video.updateMany({
      where: { id: videoId, status: 'PENDING', deletedAt: null, ...claimFreeFor(payload.id, now) },
      data: { claimedById: payload.id, claimedByName: payload.name || payload.email || 'Another moderator', claimedAt: now },
    });

    if (result.count === 1) {
      return NextResponse.json({ claimed: true, expiresAt: new Date(now.getTime() + CLAIM_TTL_MS) });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { status: true, deletedAt: true, claimedByName: true, claimedAt: true },
    });
    if (!video || video.deletedAt) {
      return NextResponse.json({ message: 'This video no longer exists.' }, { status: 404 });
    }
    if (video.status !== 'PENDING') {
      return NextResponse.json(
        { message: `This video has already been ${video.status.toLowerCase()}.`, status: video.status },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        message: `${video.claimedByName || 'Another moderator'} is reviewing this video right now.`,
        claimedByName: video.claimedByName,
        claimedAt: video.claimedAt,
      },
      { status: 409 },
    );
  } catch (err) {
    console.error('POST dashboard/videos/claim failed:', err);
    return NextResponse.json({ message: 'Could not claim the video.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MODERATOR']);
  if (error) return error;

  try {
    const { videoId } = await request.json().catch(() => ({}));
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ message: 'videoId required' }, { status: 400 });
    }
    // Only ever releases the caller's own claim.
    await prisma.video.updateMany({ where: { id: videoId, claimedById: payload.id }, data: CLEAR_CLAIM });
    return NextResponse.json({ released: true });
  } catch (err) {
    console.error('DELETE dashboard/videos/claim failed:', err);
    return NextResponse.json({ message: 'Could not release the claim.' }, { status: 500 });
  }
}
