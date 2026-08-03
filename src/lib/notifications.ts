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

export async function notifyFollow({
  followerId, followerUserId, followingId,
}: { followerId: string; followerUserId: string; followingId: string }) {
  try {
    await prisma.notification.create({
      data: {
        userId:  followingId,
        type:    'FOLLOW',
        title:   'New Follower',
        message: `${followerUserId} started following you`,
        actorId: followerId,
      },
    });
  } catch (error) {
    console.error('Failed to create follow notification:', error);
  }
}

export async function notifyFollowRequest({
  senderId, senderUserId, receiverId,
}: { senderId: string; senderUserId: string; receiverId: string }) {
  try {
    await prisma.notification.create({
      data: {
        userId:  receiverId,
        type:    'FOLLOW_REQUEST',
        title:   'Follow Request',
        message: `${senderUserId} requested to follow you`,
        actorId: senderId,
      },
    });
  } catch (error) {
    console.error('Failed to create follow-request notification:', error);
  }
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
