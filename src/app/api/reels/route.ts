import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getViewerIdFromToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch { return null; }
}

// Candidate pool size for the tiered/shuffled ordering below. Real "shuffle
// literally everything" doesn't scale — this bounds the query to the most
// recent N approved videos and orders within that window, the same practical
// tradeoff every large feed makes. Comfortably above what any one viewer will
// scroll through in a session; raise if that stops being true.
const CANDIDATE_POOL_SIZE = 2000;

// A school's own reels, then its city, then its state, then everything else.
// 3 has no upper neighbour so ties (score never seen) can't collide with it.
const TIER_SCHOOL = 0;
const TIER_CITY   = 1;
const TIER_STATE  = 2;
const TIER_OTHER  = 3;

// Deterministic hash of (seed, videoId) -> a float in [0, 1). Same seed +
// same video always lands at the same spot, but a new seed reshuffles
// everything — this is what makes paging stable within one feed-open (the
// client keeps sending the same seed as it scrolls) while looking different
// the next time the feed is opened (the client mints a fresh seed then).
function seededRank(seed: string, videoId: string): number {
  const hash = crypto.createHash('sha256').update(`${seed}:${videoId}`).digest();
  // First 4 bytes as an unsigned int, normalised to [0, 1).
  return hash.readUInt32BE(0) / 0xFFFFFFFF;
}

// GET /api/reels?cursor=<offset>&limit=10&category=dance&userId=<id>&seed=<string>
//
// `cursor` is a page offset (a string integer) rather than the previous
// row's id: a hash-seeded sort order isn't expressible as "give me rows after
// this one" the way createdAt descending is, so paging switched to offset.
// `seed` should be a random string the client generates once per feed-open
// (not once per app install) and resends unchanged for every subsequent page
// of that same session — see TermsGateScreen's sibling comment in ReelsScreen
// for where that seed is minted. Without a seed, the non-Olympiad/legacy
// ordering (createdAt desc) is used, so old app builds keep working.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor   = searchParams.get('cursor')   ?? undefined;
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20);
    const category = searchParams.get('category') ?? undefined;
    const userId   = searchParams.get('userId')   ?? undefined;
    const seed     = searchParams.get('seed')     ?? undefined;
    const offset   = cursor ? Math.max(parseInt(cursor) || 0, 0) : 0;

    const viewerId = getViewerIdFromToken(request);
    const visWhere = await visibilityWhere(viewerId);

    const where: any = {
      status:   'APPROVED',
      isPublic: true,
      ...visWhere,
    };

    if (category) where.category = { equals: category, mode: 'insensitive' };

    // Resolve the viewer's own school/city/state (Olympiad accounts only —
    // an olympiadId is what makes "their school" a meaningful concept at
    // all). Everyone else keeps the original createdAt-desc feed untouched.
    let viewerSchool: { id: string; city: string | null; state: string | null } | null = null;
    if (viewerId && seed) {
      const viewer = await prisma.appUser.findUnique({
        where:  { id: viewerId },
        select: { olympiadId: true },
      });
      if (viewer?.olympiadId) {
        const allocation = await prisma.olympiadIdAllocation.findUnique({
          where:  { code: viewer.olympiadId },
          select: { school: { select: { id: true, city: true, state: true } } },
        });
        viewerSchool = allocation?.school ?? null;
      }
    }

    const useTieredFeed = !!viewerSchool && !!seed;

    const baseSelect = {
      id:           true,
      videoUrl:     true,
      thumbnailUrl: true,
      caption:      true,
      category:     true,
      subCategory:  true,
      tags:         true,
      likesCount:   true,
      viewsCount:   true,
      createdAt:    true,
      appUserId:    true,
      isEvaluation: true,
      olympiadVisibility: true,
      student: {
        select: {
          id:   true,
          name: true,
          allocation: {
            select: {
              school: {
                select: { id: true, name: true, state: true, city: true },
              },
            },
          },
        },
      },
    } as const;

    let items: any[];
    let hasMore: boolean;
    let nextCursor: string | null;

    if (useTieredFeed) {
      // Whole pool fetched once, tiered + seed-ranked in memory, then sliced
      // for this page. Videos carry their uploader's school only two ways
      // (student.allocation.school, or appUser.olympiadId -> allocation ->
      // school for viewer uploads) — resolving which tier a video falls into
      // needs that same join, so the appUser side is batch-resolved below
      // before tiering, same as the non-tiered branch does further down.
      const pool = await prisma.video.findMany({
        take:    CANDIDATE_POOL_SIZE,
        where,
        orderBy: { createdAt: 'desc' },
        select:  baseSelect,
      });

      const poolAppUserIds = [...new Set(pool.map(v => v.appUserId).filter(Boolean))] as string[];
      const poolAppUsersRaw = poolAppUserIds.length > 0
        ? await prisma.appUser.findMany({
            where:  { id: { in: poolAppUserIds } },
            select: { id: true, olympiadId: true },
          })
        : [];
      const poolOlympiadCodes = [...new Set(poolAppUsersRaw.map(u => u.olympiadId).filter(Boolean))] as string[];
      const poolAllocationsRaw = poolOlympiadCodes.length > 0
        ? await prisma.olympiadIdAllocation.findMany({
            where:  { code: { in: poolOlympiadCodes } },
            select: { code: true, school: { select: { id: true, city: true, state: true } } },
          })
        : [];
      const poolAllocationMap = new Map(poolAllocationsRaw.map(a => [a.code, a.school]));
      const poolAppUserMap    = new Map(poolAppUsersRaw.map(u => [u.id, u]));

      const tiered = pool.map(v => {
        const studentSchool = v.student?.allocation?.school ?? null;
        const appUserOlympiadId = v.appUserId ? poolAppUserMap.get(v.appUserId)?.olympiadId : null;
        const appUserSchool = appUserOlympiadId ? (poolAllocationMap.get(appUserOlympiadId) ?? null) : null;
        const school = studentSchool ?? appUserSchool;

        let tier = TIER_OTHER;
        if (school?.id === viewerSchool!.id) tier = TIER_SCHOOL;
        else if (viewerSchool!.city  && school?.city  === viewerSchool!.city)  tier = TIER_CITY;
        else if (viewerSchool!.state && school?.state === viewerSchool!.state) tier = TIER_STATE;

        return { video: v, tier, rank: seededRank(seed!, v.id) };
      });

      tiered.sort((a, b) => (a.tier - b.tier) || (a.rank - b.rank));

      const sorted  = tiered.map(t => t.video);
      hasMore       = offset + limit < sorted.length;
      items         = sorted.slice(offset, offset + limit);
      nextCursor    = hasMore ? String(offset + limit) : null;
    } else {
      // Original behaviour: plain createdAt-desc, offset-paged instead of
      // cursor-paged now that both branches share one pagination scheme, but
      // otherwise identical to what this route always returned.
      const pageSize = await prisma.video.findMany({
        take:    limit + 1,
        skip:    offset,
        where,
        orderBy: { createdAt: 'desc' },
        select:  baseSelect,
      });
      hasMore    = pageSize.length > limit;
      items      = hasMore ? pageSize.slice(0, limit) : pageSize;
      nextCursor = hasMore ? String(offset + limit) : null;
    }

    // Check which videos the requesting user has liked — trust the authenticated
    // token over the client-supplied userId query param, which is only kept as a
    // fallback (e.g. old app builds); the token is what the like-toggle endpoint
    // itself trusts, so this must agree with it or the star shown here can
    // desync from the real Like row.
    let likedIds: Set<string> = new Set();
    const effectiveUserId = viewerId ?? userId;
    if (effectiveUserId && items.length > 0) {
      const videoIds = items.map(v => v.id);
      const userLikes = await prisma.like.findMany({
        where: { userId: effectiveUserId, videoId: { in: videoIds } },
        select: { videoId: true },
      });
      likedIds = new Set(userLikes.map(l => l.videoId));
    }

    // Batch-fetch AppUsers
    const appUserIds = [...new Set(items.map(v => v.appUserId).filter(Boolean))] as string[];
    const appUsersRaw = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where:  { id: { in: appUserIds } },
          select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
        })
      : [];
    const appUserMap = new Map(appUsersRaw.map(u => [u.id, u]));

    // Batch-fetch school info via OlympiadIdAllocation
    const olympiadCodes = [...new Set(appUsersRaw.map(u => u.olympiadId).filter(Boolean))] as string[];
    const allocationsRaw = olympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where:  { code: { in: olympiadCodes } },
          select: {
            code:   true,
            school: { select: { id: true, name: true, state: true, city: true } },
          },
        })
      : [];
    const allocationMap = new Map(allocationsRaw.map(a => [a.code, a.school]));

    const result = items.map(v => {
      const appUserRaw  = v.appUserId ? appUserMap.get(v.appUserId) : undefined;
      const studentSchool = v.student?.allocation?.school ?? null;
      const appUserSchool = appUserRaw?.olympiadId ? (allocationMap.get(appUserRaw.olympiadId) ?? null) : null;
      const school = studentSchool ?? appUserSchool;

      return {
        id:           v.id,
        videoUrl:     v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        caption:      v.caption,
        category:     v.category,
        subCategory:  v.subCategory,
        tags:         v.tags,
        likesCount:   v.likesCount,
        viewsCount:   v.viewsCount,
        createdAt:    v.createdAt,
        isLiked:      likedIds.has(v.id),
        isEvaluation: v.isEvaluation,
        olympiadVisibility: v.olympiadVisibility,
        appUserId:    v.appUserId,
        student: v.student ? {
          id:         v.student.id,
          name:       v.student.name,
          schoolId:   school?.id   ?? null,
          schoolName: school?.name ?? null,
          state:      school?.state ?? null,
          city:       school?.city  ?? null,
        } : school ? {
          id:         null,
          name:       appUserRaw?.userId ?? null,
          schoolId:   school.id,
          schoolName: school.name,
          state:      school.state ?? null,
          city:       school.city  ?? null,
        } : null,
        appUser: appUserRaw ? {
          id:        appUserRaw.id,
          userId:    appUserRaw.userId,
          avatarUrl: appUserRaw.avatarUrl,
        } : null,
      };
    });

    return NextResponse.json({ videos: result, nextCursor, hasMore });
  } catch (error) {
    console.error('GET /api/reels failed:', error);
    return NextResponse.json({ message: 'Failed to fetch reels' }, { status: 500 });
  }
}
