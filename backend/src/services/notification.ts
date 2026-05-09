import prisma from '../lib/prisma';
import redis from '../lib/redis';

const CACHE_KEY_PATTERN = 'changes:*';
const UNREAD_CACHE_PREFIX = 'unread:';

export const invalidateChangeCache = async () => {
  const keys = await redis.keys(CACHE_KEY_PATTERN);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

export const invalidateUnreadCache = async (userIds: string[]) => {
  const keys = userIds.map((id) => `${UNREAD_CACHE_PREFIX}${id}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

const getChangeParticipants = async (changeId: string, excludeUserId?: string): Promise<string[]> => {
  const change = await prisma.change.findUnique({
    where: { id: changeId },
    include: {
      reviewers: { select: { userId: true } },
      comments: { select: { authorId: true } },
    },
  });

  if (!change) return [];

  const participantIds = new Set<string>();
  participantIds.add(change.authorId);
  change.reviewers.forEach((r) => participantIds.add(r.userId));
  change.comments.forEach((c) => participantIds.add(c.authorId));

  if (excludeUserId) {
    participantIds.delete(excludeUserId);
  }

  return Array.from(participantIds);
};

export const notifyReviewersAdded = async (
  changeId: string,
  reviewerIds: string[],
  actorId: string
) => {
  const change = await prisma.change.findUnique({
    where: { id: changeId },
    include: { author: true },
  });

  if (!change) return;

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) return;

  const notifications = reviewerIds.map((userId) => ({
    userId,
    type: 'REVIEWER_ADDED' as const,
    changeId,
    message: `${actor.name} added you as a reviewer to change: ${change.title}`,
  }));

  await prisma.notification.createMany({ data: notifications });
  await invalidateUnreadCache(reviewerIds);
};

export const notifyCommentAdded = async (
  changeId: string,
  commentId: string,
  authorId: string
) => {
  const change = await prisma.change.findUnique({ where: { id: changeId } });
  if (!change) return;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: true, parent: { include: { author: true } } },
  });
  if (!comment) return;

  const participants = await getChangeParticipants(changeId, authorId);

  if (comment.parent && comment.parent.authorId !== authorId) {
    if (!participants.includes(comment.parent.authorId)) {
      participants.push(comment.parent.authorId);
    }
  }

  if (participants.length === 0) return;

  const notifications = participants.map((userId) => ({
    userId,
    type: 'COMMENT_ADDED' as const,
    changeId,
    message: `${comment.author.name} commented on change: ${change.title}`,
  }));

  await prisma.notification.createMany({ data: notifications });
  await invalidateUnreadCache(participants);
};

export const notifyVoteChanged = async (
  changeId: string,
  voterId: string,
  value: string
) => {
  const change = await prisma.change.findUnique({ where: { id: changeId } });
  if (!change) return;

  const voter = await prisma.user.findUnique({ where: { id: voterId } });
  if (!voter) return;

  const voteLabels: Record<string, string> = {
    V2_NEG: '-2',
    V1_NEG: '-1',
    V0: '0',
    V1_POS: '+1',
    V2_POS: '+2',
  };

  const participants = await getChangeParticipants(changeId, voterId);

  if (participants.length === 0) return;

  const notifications = participants.map((userId) => ({
    userId,
    type: 'VOTE_CHANGED' as const,
    changeId,
    message: `${voter.name} voted ${voteLabels[value]} on change: ${change.title}`,
  }));

  await prisma.notification.createMany({ data: notifications });
  await invalidateUnreadCache(participants);
};

export const notifyStatusChanged = async (
  changeId: string,
  oldStatus: string,
  newStatus: string,
  actorId: string
) => {
  const change = await prisma.change.findUnique({ where: { id: changeId } });
  if (!change) return;

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) return;

  const participants = await getChangeParticipants(changeId, actorId);

  if (participants.length === 0) return;

  const notifications = participants.map((userId) => ({
    userId,
    type: 'CHANGE_STATUS_CHANGED' as const,
    changeId,
    message: `${actor.name} changed status of change "${change.title}" from ${oldStatus} to ${newStatus}`,
  }));

  await prisma.notification.createMany({ data: notifications });
  await invalidateUnreadCache(participants);
};
