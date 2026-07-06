import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL } from '@/lib/olympiad-categories';

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

// Returns how many olympiad evaluation videos this user has uploaded per category slot.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [videos, user] = await Promise.all([
      prisma.video.findMany({
        where: { appUserId: appUser.id, isEvaluation: true, deletedAt: null },
        select: { category: true, subCategory: true, status: true },
      }),
      prisma.appUser.findUnique({
        where: { id: appUser.id },
        select: { olympiadId: true, olympiadCatAApproved: true, olympiadCatBApproved: true },
      }),
    ]);

    // A slot is "used" if there's a non-rejected video (PENDING or APPROVED) still on record,
    // OR the category was permanently approved before — this second check keeps the slot
    // closed even if the approved video was later deleted.
    const activeVideos = videos.filter(v => v.status !== 'REJECTED');

    const isVideoA = (v: { category: string | null; subCategory: string | null }) =>
      v.category === OLYMPIAD_CAT_A_LABEL || OLYMPIAD_CAT_A_SUBS.includes(v.subCategory ?? '');
    const isVideoB = (v: { category: string | null; subCategory: string | null }) =>
      v.category === OLYMPIAD_CAT_B_LABEL || OLYMPIAD_CAT_B_SUBS.includes(v.subCategory ?? '');

    const usedA = !!user?.olympiadCatAApproved || activeVideos.some(isVideoA);
    const usedB = !!user?.olympiadCatBApproved || activeVideos.some(isVideoB);

    const rejectedA = !usedA && videos.some(v => v.status === 'REJECTED' && isVideoA(v));
    const rejectedB = !usedB && videos.some(v => v.status === 'REJECTED' && isVideoB(v));

    // Fetch school via the olympiadId → allocation → school chain
    let schoolName: string | null = null;
    let state:      string | null = null;
    let district:   string | null = null;
    let classCode:  string | null = null;
    let className:  string | null = null;

    if (user?.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: user.olympiadId },
        select: {
          classCode: true,
          className: true,
          school: { select: { name: true, state: true, district: true } },
        },
      });
      schoolName = allocation?.school?.name     ?? null;
      state      = allocation?.school?.state    ?? null;
      district   = allocation?.school?.district ?? null;
      classCode  = allocation?.classCode        ?? null;
      className  = allocation?.className        ?? null;
    }

    return NextResponse.json({
      slotA: usedA,
      slotB: usedB,
      rejectedA,
      rejectedB,
      olympiadId: user?.olympiadId ?? null,
      schoolName,
      state,
      district,
      classCode,
      className,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
