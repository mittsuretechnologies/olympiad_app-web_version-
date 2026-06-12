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

// Category A subcategories (Performing Art + Dance + Music)
export const OLYMPIAD_CAT_A_SUBS = [
  'Rhymes Recitation',
  'Poem Recitation',
  'Story Telling',
  'Classical Dance Basics',
  'Free Style Dance',
  'Yoga Performance',
  'Singing',
  'Prayer Singing',
  'Musical Instrument Playing',
];

// Category B subcategories (Creative + Communication)
export const OLYMPIAD_CAT_B_SUBS = [
  'Craft Making',
  'Clay Modeling',
  'Paper Folding (Origami)',
  'Best Out of Waste',
  'Finger Painting',
  'Hand Printing Art',
  'Good Manners Presentation',
  'Mini Speech (My Family / My School)',
  'About Myself',
];

export const OLYMPIAD_CAT_A_LABEL = 'Performing Art, Dance & Music';
export const OLYMPIAD_CAT_B_LABEL = 'Creative Art & Communication';

// Returns how many olympiad evaluation videos this user has uploaded per category slot.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [videos, user] = await Promise.all([
      prisma.video.findMany({
        where: { appUserId: appUser.id, isEvaluation: true },
        select: { subCategory: true, status: true },
      }),
      prisma.appUser.findUnique({
        where: { id: appUser.id },
        select: { olympiadId: true },
      }),
    ]);

    // A slot is "used" only if there's a non-rejected video (PENDING or APPROVED).
    const activeVideos = videos.filter(v => v.status !== 'REJECTED');

    const usedA = activeVideos.some(v => OLYMPIAD_CAT_A_SUBS.includes(v.subCategory ?? ''));
    const usedB = activeVideos.some(v => OLYMPIAD_CAT_B_SUBS.includes(v.subCategory ?? ''));

    const rejectedA = !usedA && videos.some(v => v.status === 'REJECTED' && OLYMPIAD_CAT_A_SUBS.includes(v.subCategory ?? ''));
    const rejectedB = !usedB && videos.some(v => v.status === 'REJECTED' && OLYMPIAD_CAT_B_SUBS.includes(v.subCategory ?? ''));

    // Fetch school via the olympiadId → allocation → school chain
    let schoolName: string | null = null;
    let state:      string | null = null;
    let district:   string | null = null;

    if (user?.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: user.olympiadId },
        select: { school: { select: { name: true, state: true, district: true } } },
      });
      schoolName = allocation?.school?.name     ?? null;
      state      = allocation?.school?.state    ?? null;
      district   = allocation?.school?.district ?? null;
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
