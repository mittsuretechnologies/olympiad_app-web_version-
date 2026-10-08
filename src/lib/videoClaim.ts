/**
 * Moderation claims.
 *
 * Several moderators work the same pending queue. When one opens a video to
 * review it, the video is "claimed" in their name so the others skip it. A
 * claim is never permanent: it lapses after CLAIM_TTL_MS (the reviewer's page
 * renews it while the video stays open), and it is cleared when the decision
 * is saved. So a moderator who closes the tab or goes for lunch can't lock a
 * video for long.
 */

export const CLAIM_TTL_MS = 10 * 60 * 1000;

/** How often an open review renews its claim. Well inside the TTL. */
export const CLAIM_RENEW_MS = 4 * 60 * 1000;

/**
 * Prisma `where` fragment: the video is free for `userId` to claim or decide —
 * unclaimed, claimed by `userId` themself, or the claim has lapsed.
 */
export function claimFreeFor(userId: string, now: Date = new Date()) {
  return {
    OR: [
      { claimedById: null },
      { claimedById: userId },
      { claimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } },
    ],
  };
}

/** Whether a stored claim is still live (not lapsed). */
export function claimIsLive(claimedAt: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!claimedAt) return false;
  return now - new Date(claimedAt).getTime() < CLAIM_TTL_MS;
}

/** Clears a claim — spread into a video update's `data` when a decision is saved. */
export const CLEAR_CLAIM = { claimedById: null, claimedByName: null, claimedAt: null } as const;
