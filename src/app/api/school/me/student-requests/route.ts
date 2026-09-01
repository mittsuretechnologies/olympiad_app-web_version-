import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET /api/school/me/student-requests
// Every link request aimed at the logged-in school: PENDING ones awaiting a
// decision, plus the APPROVED and REJECTED history so the school can see who it
// has already linked and undo a decision.
//
// Each row carries enough of the requester for the school to judge it - their
// handle, contact, and a preview of the videos that would surface once linked.
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const requests = await prisma.schoolLinkRequest.findMany({
      where:   { schoolId: payload.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, status: true, createdAt: true, decidedAt: true,
        appUser: {
          select: {
            id: true, userId: true, email: true, mobile: true,
            avatarUrl: true, isPrivate: true, createdAt: true,
          },
        },
      },
    });

    if (requests.length === 0) return NextResponse.json([]);

    const appUserIds = requests.map(r => r.appUser.id);

    // Counts for every requester in one groupBy - same filter the portal's own
    // Student Videos page uses (APPROVED, not soft-deleted), so this number
    // matches what would actually appear once the student is linked.
    const counts = await prisma.video.groupBy({
      by:    ['appUserId'],
      where: { appUserId: { in: appUserIds }, status: 'APPROVED', deletedAt: null },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map(c => [c.appUserId, c._count._all]));

    // Previews are fetched per requester rather than as one capped batch: a
    // single prolific uploader would otherwise swallow a shared take() and
    // leave everyone below them showing no videos at all - exactly the rows a
    // school most needs to see before approving. Only PENDING rows need the
    // evidence, and that list is short, so the query count stays small.
    const pending = requests.filter(r => r.status === 'PENDING');
    const previewLists = await Promise.all(
      pending.map(r => prisma.video.findMany({
        where:   { appUserId: r.appUser.id, status: 'APPROVED', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, thumbnailUrl: true, videoUrl: true, caption: true, createdAt: true },
        take:    3,
      })),
    );
    const previewBy = new Map(pending.map((r, i) => [r.appUser.id, previewLists[i]]));

    return NextResponse.json(requests.map(r => ({
      id:        r.id,
      status:    r.status,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      appUserId: r.appUser.id,
      username:  r.appUser.userId,
      email:     r.appUser.email,
      mobile:    r.appUser.mobile,
      avatarUrl: r.appUser.avatarUrl,
      isPrivate: r.appUser.isPrivate,
      joinedAt:  r.appUser.createdAt,
      videoCount: countBy.get(r.appUser.id) ?? 0,
      previewVideos: previewBy.get(r.appUser.id) ?? [],
    })));
  } catch (err) {
    console.error('GET /api/school/me/student-requests failed:', err);
    return NextResponse.json({ message: 'Failed to fetch requests' }, { status: 500 });
  }
}
