import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  notifyReviewersAdded,
  notifyCommentAdded,
  notifyVoteChanged,
  notifyStatusChanged,
  invalidateChangeCache,
  invalidateUnreadCache,
} from '../services/notification';

vi.mock('../lib/prisma', () => ({
  default: {
    change: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/redis', () => ({
  default: {
    keys: vi.fn(),
    del: vi.fn(),
  },
}));

import prisma from '../lib/prisma';
import redis from '../lib/redis';

const mockChange = {
  id: 'change-1',
  title: 'Test Change',
  status: 'Open',
  authorId: 'author-1',
  author: { id: 'author-1', name: 'Author User' },
  reviewers: [{ userId: 'reviewer-1' }],
  comments: [{ authorId: 'commenter-1' }],
};

const mockUser = (id: string, name: string) => ({ id, name });

const mockComment = {
  id: 'comment-1',
  authorId: 'commenter-1',
  author: { id: 'commenter-1', name: 'Commenter User' },
  parent: null,
};

describe('notification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notifyReviewersAdded', () => {
    it('happy path - should create notifications for reviewers', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser('actor-1', 'Actor User'));
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });
      (redis.del as any).mockResolvedValue(1);

      await notifyReviewersAdded('change-1', ['reviewer-1', 'reviewer-2'], 'actor-1');

      expect(prisma.change.findUnique).toHaveBeenCalledWith({
        where: { id: 'change-1' },
        include: { author: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'actor-1' } });
      expect(prisma.notification.createMany).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyReviewersAdded('change-1', ['reviewer-1'], 'actor-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should return early if actor not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyReviewersAdded('change-1', ['reviewer-1'], 'actor-1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should handle notification channel failure gracefully', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser('actor-1', 'Actor User'));
      (prisma.notification.createMany as any).mockRejectedValue(new Error('DB Error'));

      await expect(
        notifyReviewersAdded('change-1', ['reviewer-1'], 'actor-1')
      ).rejects.toThrow('DB Error');
    });

    it('should handle redis cache invalidation failure', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser('actor-1', 'Actor User'));
      (prisma.notification.createMany as any).mockResolvedValue({ count: 1 });
      (redis.del as any).mockRejectedValue(new Error('Redis Error'));

      await expect(
        notifyReviewersAdded('change-1', ['reviewer-1'], 'actor-1')
      ).rejects.toThrow('Redis Error');
    });
  });

  describe('notifyCommentAdded', () => {
    it('happy path - should notify participants', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.comment.findUnique as any).mockResolvedValue(mockComment);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });
      (redis.del as any).mockResolvedValue(1);

      await notifyCommentAdded('change-1', 'comment-1', 'commenter-1');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.comment.findUnique).toHaveBeenCalled();
      expect(prisma.notification.createMany).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyCommentAdded('change-1', 'comment-1', 'author-1');

      expect(prisma.comment.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if comment not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.comment.findUnique as any).mockResolvedValue(null);

      await notifyCommentAdded('change-1', 'comment-1', 'author-1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should add parent comment author to participants', async () => {
      const commentWithParent = {
        ...mockComment,
        parent: { authorId: 'parent-author', author: { id: 'parent-author', name: 'Parent Author' } },
      };
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.comment.findUnique as any).mockResolvedValue(commentWithParent);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 3 });
      (redis.del as any).mockResolvedValue(1);

      await notifyCommentAdded('change-1', 'comment-1', 'commenter-1');

      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if no participants', async () => {
      const changeNoParticipants = {
        ...mockChange,
        reviewers: [],
        comments: [],
      };
      (prisma.change.findUnique as any).mockResolvedValue(changeNoParticipants);
      (prisma.comment.findUnique as any).mockResolvedValue({ ...mockComment, authorId: 'author-1' });

      await notifyCommentAdded('change-1', 'comment-1', 'author-1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('notifyVoteChanged', () => {
    it('happy path - should notify participants of vote', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser('voter-1', 'Voter User'));
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });
      (redis.del as any).mockResolvedValue(1);

      await notifyVoteChanged('change-1', 'voter-1', 'V1_POS');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyVoteChanged('change-1', 'voter-1', 'V1_POS');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if voter not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyVoteChanged('change-1', 'voter-1', 'V1_POS');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('notifyStatusChanged', () => {
    it('happy path - should notify participants of status change', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser('actor-1', 'Actor User'));
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });
      (redis.del as any).mockResolvedValue(1);

      await notifyStatusChanged('change-1', 'Open', 'Merged', 'actor-1');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyStatusChanged('change-1', 'Open', 'Merged', 'actor-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if actor not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyStatusChanged('change-1', 'Open', 'Merged', 'actor-1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('invalidateChangeCache', () => {
    it('should delete all change cache keys', async () => {
      (redis.keys as any).mockResolvedValue(['changes:key1', 'changes:key2']);
      (redis.del as any).mockResolvedValue(2);

      await invalidateChangeCache();

      expect(redis.keys).toHaveBeenCalledWith('changes:*');
      expect(redis.del).toHaveBeenCalledWith('changes:key1', 'changes:key2');
    });

    it('should not delete if no keys found', async () => {
      (redis.keys as any).mockResolvedValue([]);

      await invalidateChangeCache();

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateUnreadCache', () => {
    it('should delete unread cache for given user ids', async () => {
      (redis.del as any).mockResolvedValue(2);

      await invalidateUnreadCache(['user-1', 'user-2']);

      expect(redis.del).toHaveBeenCalledWith('unread:user-1', 'unread:user-2');
    });

    it('should not delete if no user ids', async () => {
      await invalidateUnreadCache([]);

      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
