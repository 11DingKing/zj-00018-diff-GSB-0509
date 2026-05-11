import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  invalidateChangeCache,
  invalidateUnreadCache,
  notifyReviewersAdded,
  notifyCommentAdded,
  notifyVoteChanged,
  notifyStatusChanged,
} from './notification';

vi.mock('../lib/prisma', () => ({
  default: {
    change: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
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

describe('notification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invalidateChangeCache', () => {
    it('should delete all change cache keys', async () => {
      (redis.keys as any).mockResolvedValue(['changes:1', 'changes:2']);

      await invalidateChangeCache();

      expect(redis.keys).toHaveBeenCalledWith('changes:*');
      expect(redis.del).toHaveBeenCalledWith('changes:1', 'changes:2');
    });

    it('should not call del if no keys found', async () => {
      (redis.keys as any).mockResolvedValue([]);

      await invalidateChangeCache();

      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should handle redis failure gracefully', async () => {
      (redis.keys as any).mockRejectedValue(new Error('Redis down'));

      await expect(invalidateChangeCache()).rejects.toThrow('Redis down');
    });
  });

  describe('invalidateUnreadCache', () => {
    it('should delete unread cache for given user ids', async () => {
      const userIds = ['user1', 'user2'];

      await invalidateUnreadCache(userIds);

      expect(redis.del).toHaveBeenCalledWith('unread:user1', 'unread:user2');
    });

    it('should not call del if empty user ids', async () => {
      await invalidateUnreadCache([]);

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('notifyReviewersAdded', () => {
    it('should create notifications for reviewers - happy path', async () => {
      const mockChange = {
        id: 'change1',
        title: 'Test Change',
        author: { id: 'author1', name: 'Author' },
      };
      const mockActor = { id: 'actor1', name: 'Actor Name' };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockActor);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });

      await notifyReviewersAdded('change1', ['reviewer1', 'reviewer2'], 'actor1');

      expect(prisma.change.findUnique).toHaveBeenCalledWith({
        where: { id: 'change1' },
        include: { author: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'actor1' },
      });
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyReviewersAdded('change1', ['reviewer1'], 'actor1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should return early if actor not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue({ id: 'change1', title: 'Test' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyReviewersAdded('change1', ['reviewer1'], 'actor1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should degrade gracefully when prisma fails', async () => {
      (prisma.change.findUnique as any).mockResolvedValue({
        id: 'change1',
        title: 'Test',
        author: { name: 'Author' },
      });
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'actor1', name: 'Actor' });
      (prisma.notification.createMany as any).mockRejectedValue(new Error('DB down'));

      await expect(
        notifyReviewersAdded('change1', ['reviewer1'], 'actor1')
      ).rejects.toThrow('DB down');
    });
  });

  describe('notifyCommentAdded', () => {
    it('should create notifications for participants - happy path', async () => {
      const mockChange = {
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'reviewer1' }],
        comments: [{ authorId: 'commenter1' }],
      };
      const mockComment = {
        id: 'comment1',
        author: { id: 'author1', name: 'Comment Author' },
        parent: null,
      };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.comment.findUnique as any).mockResolvedValue(mockComment);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });

      await notifyCommentAdded('change1', 'comment1', 'author1');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.comment.findUnique).toHaveBeenCalled();
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyCommentAdded('change1', 'comment1', 'author1');

      expect(prisma.comment.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if comment not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue({ id: 'change1' });
      (prisma.comment.findUnique as any).mockResolvedValue(null);

      await notifyCommentAdded('change1', 'comment1', 'author1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should not create notifications if no participants', async () => {
      const mockChange = {
        id: 'change1',
        authorId: 'author1',
        reviewers: [],
        comments: [],
      };
      const mockComment = {
        id: 'comment1',
        author: { id: 'author1', name: 'Author' },
        parent: null,
      };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.comment.findUnique as any).mockResolvedValue(mockComment);

      await notifyCommentAdded('change1', 'comment1', 'author1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('notifyVoteChanged', () => {
    it('should create vote notifications - happy path', async () => {
      const mockChange = {
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'reviewer1' }],
        comments: [],
      };
      const mockVoter = { id: 'voter1', name: 'Voter Name' };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockVoter);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 1 });

      await notifyVoteChanged('change1', 'voter1', 'V1_POS');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'voter1' } });
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyVoteChanged('change1', 'voter1', 'V1_POS');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if voter not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue({ id: 'change1' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyVoteChanged('change1', 'voter1', 'V1_POS');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should handle all vote values correctly', async () => {
      const voteValues = ['V2_NEG', 'V1_NEG', 'V0', 'V1_POS', 'V2_POS'];

      for (const value of voteValues) {
        vi.clearAllMocks();
        (prisma.change.findUnique as any).mockResolvedValue({
          id: 'change1',
          authorId: 'author1',
          reviewers: [{ userId: 'reviewer1' }],
          comments: [],
        });
        (prisma.user.findUnique as any).mockResolvedValue({ id: 'voter1', name: 'Voter' });

        await notifyVoteChanged('change1', 'voter1', value);

        expect(prisma.notification.createMany).toHaveBeenCalled();
      }
    });
  });

  describe('notifyStatusChanged', () => {
    it('should create status change notifications - happy path', async () => {
      const mockChange = {
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'reviewer1' }],
        comments: [],
      };
      const mockActor = { id: 'actor1', name: 'Actor Name' };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockActor);
      (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });

      await notifyStatusChanged('change1', 'Open', 'Merged', 'actor1');

      expect(prisma.change.findUnique).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'actor1' } });
      expect(prisma.notification.createMany).toHaveBeenCalled();
    });

    it('should return early if change not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue(null);

      await notifyStatusChanged('change1', 'Open', 'Merged', 'actor1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return early if actor not found', async () => {
      (prisma.change.findUnique as any).mockResolvedValue({ id: 'change1' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await notifyStatusChanged('change1', 'Open', 'Merged', 'actor1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should not create notifications if no participants', async () => {
      const mockChange = {
        id: 'change1',
        authorId: 'actor1',
        reviewers: [],
        comments: [],
      };
      const mockActor = { id: 'actor1', name: 'Actor' };

      (prisma.change.findUnique as any).mockResolvedValue(mockChange);
      (prisma.user.findUnique as any).mockResolvedValue(mockActor);

      await notifyStatusChanged('change1', 'Open', 'Merged', 'actor1');

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
