import { prisma } from '@/lib/prisma';

/**
 * Returns a Prisma `where` fragment that enforces the visibility matrix:
 *
 *   Regular Video   | Public account  → Everyone
 *   Regular Video   | Private account → Followers only
 *
 *   Olympiad Video (isEvaluation) additionally requires olympiadVisibility === 'public'
 *   for anyone other than the owner — see the 4-case matrix on canViewOlympiadVideo below.
 *   (Evaluation/marking is unaffected: evaluator routes query Video directly and never
 *   call this helper, so a video's visibility never blocks it from being scored.)
 *
 * Pass the UUID of the logged-in app user (or null for anonymous).
 * The returned object is merged into the caller's `where` clause.
 *
 * Usage:
 *   const vis = await visibilityWhere(viewerId);
 *   prisma.video.findMany({ where: { status: 'APPROVED', isPublic: true, ...vis } })
 */
export async function visibilityWhere(viewerId: string | null): Promise<object> {
  // Soft-deleted videos are always excluded from every public/user-facing view —
  // the record is retained (for SuperAdmin) but must never surface here.
  const base: Record<string, any> = { deletedAt: null };

  // Private Olympiad videos are hidden from everyone except their owner.
  const olympiadPrivacyClause = {
    NOT: {
      AND: [
        { isEvaluation: true },
        { olympiadVisibility: { not: 'public' } },
        ...(viewerId ? [{ appUserId: { not: viewerId } }] : []),
      ],
    },
  };

  // Get all private-account user IDs
  const privateUsers = await prisma.appUser.findMany({
    where:  { isPrivate: true },
    select: { id: true },
  });

  if (privateUsers.length === 0) {
    // No private accounts exist — only the Olympiad-privacy clause applies
    return { ...base, ...olympiadPrivacyClause };
  }

  const allPrivateIds = privateUsers.map(u => u.id);

  // Which of those private accounts does the viewer follow?
  const allowedPrivateIds = new Set<string>();
  if (viewerId) {
    const follows = await prisma.follow.findMany({
      where:  { followerId: viewerId, followingId: { in: allPrivateIds } },
      select: { followingId: true },
    });
    follows.forEach(f => allowedPrivateIds.add(f.followingId));
    // Viewer can always see their own videos even if their account is private
    allowedPrivateIds.add(viewerId);
  }

  // IDs of private accounts whose videos must be hidden from this viewer
  const blockedIds = allPrivateIds.filter(id => !allowedPrivateIds.has(id));

  if (blockedIds.length === 0) return { ...base, ...olympiadPrivacyClause };

  return {
    ...base,
    AND: [
      { NOT: { appUserId: { in: blockedIds } } },
      olympiadPrivacyClause,
    ],
  };
}

/**
 * Pure single-video check for the Olympiad visibility matrix:
 *
 *   Profile   | Video    | Visible to
 *   Public    | Public   | Everyone
 *   Private   | Public   | Approved followers only (+ owner, + SuperAdmin)
 *   Public    | Private  | Owner + SuperAdmin only
 *   Private   | Private  | Owner + SuperAdmin only
 *
 * Use this for single-video fetches (detail view, direct link) where an explicit
 * boolean is needed. List queries should use visibilityWhere() instead.
 */
export function canViewOlympiadVideo(
  viewer: { id: string; role?: string } | null,
  video: { appUserId: string | null; isEvaluation: boolean; olympiadVisibility: string | null },
  ownerIsPrivate: boolean,
  isFollowing: boolean
): boolean {
  if (!video.isEvaluation) return true; // not an Olympiad video, this rule doesn't apply
  if (viewer?.role === 'SUPERADMIN') return true;
  if (viewer && viewer.id === video.appUserId) return true;
  if (video.olympiadVisibility !== 'public') return false; // private olympiad video
  return !ownerIsPrivate || isFollowing;
}
