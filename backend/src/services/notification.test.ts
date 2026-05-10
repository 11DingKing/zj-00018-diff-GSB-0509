import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

import prisma from '../lib/prisma';
import redis from '../lib/redis';
import {
  invalidateChangeCache,
  invalidateUnreadCache,
  notifyReviewersAdded,
  notifyCommentAdded,
  notifyVoteChanged,
  notifyStatusChanged,
} from '../services/notification';

const mockedPrisma = vi.mocked(prisma);
const mockedRedis = vi.mocked(redis);

describe('invalidateChangeCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes all change cache keys', async () => {
    mockedRedis.keys.mockResolvedValueOnce(['changes:1', 'changes:2']);
    await invalidateChangeCache();
    expect(mockedRedis.keys).toHaveBeenCalledWith('changes:*');
    expect(mockedRedis.del).toHaveBeenCalledWith('changes:1', 'changes:2');
  });

  it('does nothing when no cache keys exist', async () => {
    mockedRedis.keys.mockResolvedValueOnce([]);
    await invalidateChangeCache();
    expect(mockedRedis.del).not.toHaveBeenCalled();
  });
});

describe('invalidateUnreadCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes unread cache keys for given users', async () => {
    await invalidateUnreadCache(['user1', 'user2']);
    expect(mockedRedis.del).toHaveBeenCalledWith('unread:user1', 'unread:user2');
  });

  it('does nothing when user list is empty', async () => {
    await invalidateUnreadCache([]);
    expect(mockedRedis.del).not.toHaveBeenCalled();
  });
});

describe('notifyReviewersAdded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notifications for reviewers (happy path)', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test Change',
      authorId: 'author1',
      author: { id: 'author1', name: 'Author' },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'actor1',
      name: 'Actor',
    } as any);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 2 } as any);

    await notifyReviewersAdded('change1', ['rev1', 'rev2'], 'actor1');

    expect(mockedPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'rev1', type: 'REVIEWER_ADDED', changeId: 'change1', message: 'Actor added you as a reviewer to change: Test Change' },
        { userId: 'rev2', type: 'REVIEWER_ADDED', changeId: 'change1', message: 'Actor added you as a reviewer to change: Test Change' },
      ],
    });
    expect(mockedRedis.del).toHaveBeenCalledWith('unread:rev1', 'unread:rev2');
  });

  it('does nothing when change is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce(null);
    await notifyReviewersAdded('nonexistent', ['rev1'], 'actor1');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when actor is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test',
      authorId: 'author1',
      author: { id: 'author1', name: 'Author' },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    await notifyReviewersAdded('change1', ['rev1'], 'nonexistent');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('gracefully handles notification creation failure (degradation)', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test',
      authorId: 'author1',
      author: { id: 'author1', name: 'Author' },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'actor1',
      name: 'Actor',
    } as any);
    mockedPrisma.notification.createMany.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(notifyReviewersAdded('change1', ['rev1'], 'actor1')).rejects.toThrow('DB connection lost');
  });
});

describe('notifyCommentAdded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notifications for participants (happy path)', async () => {
    mockedPrisma.change.findUnique
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
      } as any)
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'rev1' }],
        comments: [{ authorId: 'commenter1' }],
      } as any);
    mockedPrisma.comment.findUnique.mockResolvedValueOnce({
      id: 'comment1',
      authorId: 'commenter1',
      author: { name: 'Commenter' },
      parent: null,
    } as any);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 } as any);

    await notifyCommentAdded('change1', 'comment1', 'otherAuthor');

    expect(mockedPrisma.notification.createMany).toHaveBeenCalled();
    const callArgs = mockedPrisma.notification.createMany.mock.calls[0][0] as { data: any[] };
    expect(callArgs.data.length).toBeGreaterThan(0);
    expect(callArgs.data[0].type).toBe('COMMENT_ADDED');
  });

  it('does nothing when change is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce(null);
    await notifyCommentAdded('nonexistent', 'comment1', 'author1');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when comment is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test',
      authorId: 'author1',
    } as any);
    mockedPrisma.comment.findUnique.mockResolvedValueOnce(null);
    await notifyCommentAdded('change1', 'nonexistent', 'author1');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('includes parent comment author in notifications', async () => {
    mockedPrisma.change.findUnique
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
      } as any)
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [],
        comments: [{ authorId: 'commenter1' }],
      } as any);
    mockedPrisma.comment.findUnique.mockResolvedValueOnce({
      id: 'comment1',
      authorId: 'commenter1',
      author: { name: 'Commenter' },
      parent: { authorId: 'parentAuthor', author: { name: 'Parent' } },
    } as any);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 } as any);

    await notifyCommentAdded('change1', 'comment1', 'commenter1');

    const callArgs = mockedPrisma.notification.createMany.mock.calls[0][0] as { data: any[] };
    const notifiedIds = callArgs.data.map((n: any) => n.userId);
    expect(notifiedIds).toContain('parentAuthor');
  });
});

describe('notifyVoteChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates vote notifications with correct labels (happy path)', async () => {
    mockedPrisma.change.findUnique
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'rev1' }],
        comments: [],
      } as any)
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'rev1' }],
        comments: [],
      } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'voter1',
      name: 'Voter',
    } as any);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 } as any);

    await notifyVoteChanged('change1', 'voter1', 'V2_POS');

    const callArgs = mockedPrisma.notification.createMany.mock.calls[0][0] as { data: any[] };
    expect(callArgs.data[0].message).toContain('+2');
    expect(callArgs.data[0].type).toBe('VOTE_CHANGED');
  });

  it('does nothing when change is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce(null);
    await notifyVoteChanged('nonexistent', 'voter1', 'V2_POS');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when voter is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test',
      authorId: 'author1',
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    await notifyVoteChanged('change1', 'nonexistent', 'V2_POS');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe('notifyStatusChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates status change notifications (happy path)', async () => {
    mockedPrisma.change.findUnique
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'rev1' }],
        comments: [],
      } as any)
      .mockResolvedValueOnce({
        id: 'change1',
        title: 'Test Change',
        authorId: 'author1',
        reviewers: [{ userId: 'rev1' }],
        comments: [],
      } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'actor1',
      name: 'Actor',
    } as any);
    mockedPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 } as any);

    await notifyStatusChanged('change1', 'Open', 'Merged', 'actor1');

    const callArgs = mockedPrisma.notification.createMany.mock.calls[0][0] as { data: any[] };
    expect(callArgs.data[0].type).toBe('CHANGE_STATUS_CHANGED');
    expect(callArgs.data[0].message).toContain('Open');
    expect(callArgs.data[0].message).toContain('Merged');
  });

  it('does nothing when change is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce(null);
    await notifyStatusChanged('nonexistent', 'Open', 'Merged', 'actor1');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when actor is not found', async () => {
    mockedPrisma.change.findUnique.mockResolvedValueOnce({
      id: 'change1',
      title: 'Test',
      authorId: 'author1',
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    await notifyStatusChanged('change1', 'Open', 'Merged', 'nonexistent');
    expect(mockedPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});
