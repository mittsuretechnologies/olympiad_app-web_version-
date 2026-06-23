import { prisma } from '@/lib/prisma';

/**
 * Returns a Prisma `where` fragment that enforces the visibility matrix:
 *
 *   Regular Video        | Public account  → Everyone
 *   Regular Video        | Private account → Followers only
 *   Olympiad Public  (isPublic true)  | same as regular
 *   Olympiad Private (isPublic false) → Hidden from everyone (student/reviewer/admin only)
 *
 * Pass the UUID of the logged-in app user (or null for anonymous).
 * The returned object is merged into the caller's `where` clause.
 *
 * Usage:
 *   const vis = await visibilityWhere(viewerId);
 *   prisma.video.findMany({ where: { status: 'APPROVED', isPublic: true, ...vis } })
 */
export async function visibilityWhere(viewerId: string | null): Promise<object> {
  // Private olympiad videos are always excluded — callers must keep isPublic: true
  // so this function only needs to handle the private-account gate.

  // Get all private-account user IDs
  const privateUsers = await prisma.appUser.findMany({
    where:  { isPrivate: true },
    select: { id: true },
  });

  if (privateUsers.length === 0) {
    // No private accounts exist — nothing to filter
    return {};
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

  if (blockedIds.length === 0) return {};

  return {
    NOT: { appUserId: { in: blockedIds } },
  };
}
