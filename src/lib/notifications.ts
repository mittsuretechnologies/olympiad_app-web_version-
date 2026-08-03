import { prisma } from '@/lib/prisma';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  videoId?: string | null;
}

// Fire-and-forget-safe: awaited by callers, but a notification failure never
// throws past this function so it can't take down the action that triggered it.
export async function createNotification(entry: CreateNotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        userId:  entry.userId,
        type:    entry.type,
        title:   entry.title,
        message: entry.message,
        videoId: entry.videoId ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error, entry);
  }
}

// Follow alerts are deduped per (recipient, actor) rather than inserting a row
// per event: unfollow/re-follow cycles would otherwise stack up identical
// entries in the recipient's feed. recentActorIds carries the actor, matching
// how VIDEO_LIKED below reuses the same row.
async function upsertActorNotification({
  userId, actorId, type, title, message,
}: { userId: string; actorId: string; type: string; title: string; message: string }) {
  try {
    const existing = await prisma.notification.findFirst({
      where: { userId, type, recentActorIds: { has: actorId } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: { title, message, isRead: false, createdAt: new Date() },
      });
    } else {
      await prisma.notification.create({
        data: { userId, type, title, message, count: 1, recentActorIds: [actorId] },
      });
    }
  } catch (error) {
    console.error(`Failed to record ${type} notification:`, error);
  }
}

// Someone followed a public account.
export async function notifyNewFollower({
  followedId, followerId, followerUserId,
}: { followedId: string; followerId: string; followerUserId: string }) {
  await upsertActorNotification({
    userId:  followedId,
    actorId: followerId,
    type:    'FOLLOW',
    title:   'New Follower',
    message: `${followerUserId} started following you`,
  });
}

// Someone asked to follow a private account.
export async function notifyFollowRequest({
  receiverId, senderId, senderUserId,
}: { receiverId: string; senderId: string; senderUserId: string }) {
  await upsertActorNotification({
    userId:  receiverId,
    actorId: senderId,
    type:    'FOLLOW_REQUEST',
    title:   'Follow Request',
    message: `${senderUserId} requested to follow you`,
  });
}

// A private account approved a pending request — tell the person who asked.
export async function notifyFollowAccepted({
  senderId, receiverId, receiverUserId,
}: { senderId: string; receiverId: string; receiverUserId: string }) {
  await upsertActorNotification({
    userId:  senderId,
    actorId: receiverId,
    type:    'FOLLOW',
    title:   'Follow Request Accepted',
    message: `${receiverUserId} accepted your follow request`,
  });
}

function formatLikeMessage(firstActorUserId: string, count: number): string {
  if (count <= 1) return `${firstActorUserId} starred your video`;
  if (count === 2) return `${firstActorUserId} and 1 other starred your video`;
  return `${firstActorUserId} and ${count - 1} others starred your video`;
}

// Aggregates stars/likes on the same video into a single, ever-growing
// notification instead of inserting one row per like — otherwise a video that
// goes viral would flood the owner's notification feed (and the table) with
// thousands of rows, and two different people starring the same video would
// wrongly show up as two separate alerts. There is at most one VIDEO_LIKED
// row per (owner, video), regardless of read state: every new like updates
// that same row (bumping its count and resurfacing it as unread) rather than
// starting a new group, matching how Instagram keeps one growing notification
// per post.
export async function notifyVideoLiked({
  ownerId, videoId, likerUserId,
}: { ownerId: string; videoId: string; likerUserId: string }) {
  try {
    const existing = await prisma.notification.findFirst({
      where: { userId: ownerId, videoId, type: 'VIDEO_LIKED' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const nextCount = existing.count + 1;
      const recentActorIds = [likerUserId, ...existing.recentActorIds.filter(id => id !== likerUserId)].slice(0, 3);
      await prisma.notification.update({
        where: { id: existing.id },
        data: {
          count: nextCount,
          recentActorIds,
          message: formatLikeMessage(recentActorIds[0], nextCount),
          isRead: false,
          createdAt: new Date(), // resurface to the top of the feed
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId:  ownerId,
          type:    'VIDEO_LIKED',
          title:   'New Star',
          message: formatLikeMessage(likerUserId, 1),
          videoId,
          count: 1,
          recentActorIds: [likerUserId],
        },
      });
    }
  } catch (error) {
    console.error('Failed to record like notification:', error);
  }
}
