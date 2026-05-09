import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { notifyReviewersAdded, notifyCommentAdded, notifyVoteChanged, notifyStatusChanged, invalidateChangeCache } from '../services/notification';

const router = Router();

const createChangeSchema = z.object({
  repositoryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  reviewers: z.array(z.string()).default([]),
  patchset: z.object({
    message: z.string().optional(),
    diffs: z.array(
      z.object({
        filePath: z.string(),
        diffText: z.string(),
        status: z.enum(['added', 'modified', 'deleted', 'renamed']),
      })
    ),
  }),
});

const updateStatusSchema = z.object({
  status: z.enum(['Draft', 'Open', 'Review', 'Merged', 'Abandoned']),
});

const addReviewerSchema = z.object({
  userId: z.string(),
});

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createChangeSchema.parse(req.body);

    const repo = await prisma.repository.findUnique({
      where: { id: body.repositoryId },
      include: { branches: true },
    });
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const change = await prisma.change.create({
      data: {
        title: body.title,
        description: body.description,
        repositoryId: body.repositoryId,
        authorId: req.userId!,
        sourceBranch: body.sourceBranch,
        targetBranch: body.targetBranch,
        status: 'Open',
        patchsets: {
          create: {
            number: 1,
            message: body.patchset.message,
            diffFiles: {
              create: body.patchset.diffs.map((d) => ({
                filePath: d.filePath,
                diffText: d.diffText,
                status: d.status,
              })),
            },
          },
        },
        reviewers: {
          create: body.reviewers.map((userId) => ({ userId })),
        },
        checks: {
          create: [
            { name: 'lint', status: 'Passed', message: 'All checks passed', isRequired: true },
            { name: 'ci', status: 'Pending', message: null, isRequired: true },
          ],
        },
      },
      include: {
        author: { select: { id: true, username: true, name: true } },
        repository: true,
        patchsets: { include: { diffFiles: true } },
        reviewers: { include: { user: { select: { id: true, username: true, name: true } } } },
        checks: true,
      },
    });

    if (body.reviewers.length > 0) {
      await notifyReviewersAdded(change.id, body.reviewers, req.userId!);
    }

    await invalidateChangeCache();
    res.json({ change });
  })
);

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { cursor, limit = 20, status, authorId } = req.query;

    const cacheKey = `changes:${JSON.stringify({ cursor, limit, status, authorId })}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const where: any = {};
    if (status) where.status = status;
    if (authorId) where.authorId = authorId;

    const changes = await prisma.change.findMany({
      take: Number(limit),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, name: true } },
        repository: { select: { id: true, name: true } },
        patchsets: { select: { id: true, number: true }, orderBy: { number: 'desc' }, take: 1 },
        reviewers: { include: { user: { select: { id: true, username: true, name: true } } } },
        checks: true,
        votes: true,
      },
    });

    const result = {
      changes,
      nextCursor: changes.length === Number(limit) ? changes[changes.length - 1].id : null,
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    res.json(result);
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const change = await prisma.change.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, username: true, name: true } },
        repository: { select: { id: true, name: true } },
        patchsets: {
          include: { diffFiles: true, votes: { include: { user: { select: { id: true, username: true, name: true } } } } },
          orderBy: { number: 'desc' },
        },
        reviewers: { include: { user: { select: { id: true, username: true, name: true } } } },
        checks: true,
        votes: { include: { user: { select: { id: true, username: true, name: true } } } },
        comments: {
          include: { author: { select: { id: true, username: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!change) {
      res.status(404).json({ error: 'Change not found' });
      return;
    }

    res.json({ change });
  })
);

router.post(
  '/:id/status',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = updateStatusSchema.parse(req.body);
    const changeId = req.params.id;

    const change = await prisma.change.findUnique({ where: { id: changeId } });
    if (!change) {
      res.status(404).json({ error: 'Change not found' });
      return;
    }

    const isAdmin = req.user?.role === 'ADMIN';
    const isAuthor = change.authorId === req.userId;

    if (!isAdmin && !isAuthor) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (body.status === 'Merged' && !isAdmin) {
      const latestPatchset = await prisma.patchset.findFirst({
        where: { changeId },
        orderBy: { number: 'desc' },
        include: { votes: true },
      });

      if (!latestPatchset) {
        res.status(400).json({ error: 'No patchset found' });
        return;
      }

      const hasPlus2 = latestPatchset.votes.some((v) => v.value === 'V2_POS');
      const hasMinus2 = latestPatchset.votes.some((v) => v.value === 'V2_NEG');

      const checks = await prisma.check.findMany({ where: { changeId, isRequired: true } });
      const allChecksPassed = checks.every((c) => c.status === 'Passed');

      if (!hasPlus2 || hasMinus2 || !allChecksPassed) {
        res.status(400).json({
          error: 'Merge conditions not met: need at least one +2, no -2, and all required checks passed',
        });
        return;
      }
    }

    const updated = await prisma.change.update({
      where: { id: changeId },
      data: { status: body.status as any },
      include: {
        author: { select: { id: true, username: true, name: true } },
        repository: { select: { id: true, name: true } },
      },
    });

    await notifyStatusChanged(changeId, change.status as any, body.status, req.userId!);
    await invalidateChangeCache();
    res.json({ change: updated });
  })
);

router.post(
  '/:id/reviewers',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = addReviewerSchema.parse(req.body);
    const changeId = req.params.id;

    const change = await prisma.change.findUnique({ where: { id: changeId } });
    if (!change) {
      res.status(404).json({ error: 'Change not found' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    try {
      await prisma.changeReviewer.create({
        data: { changeId, userId: body.userId },
      });
      await notifyReviewersAdded(changeId, [body.userId], req.userId!);
    } catch (e: any) {
      if (e.code === 'P2002') {
        res.status(400).json({ error: 'User already a reviewer' });
        return;
      }
      throw e;
    }

    const updated = await prisma.change.findUnique({
      where: { id: changeId },
      include: {
        reviewers: { include: { user: { select: { id: true, username: true, name: true } } } },
      },
    });

    res.json({ change: updated });
  })
);

router.post(
  '/:id/checks/:checkName/retry',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id: changeId, checkName } = req.params;

    const check = await prisma.check.findUnique({
      where: { changeId_name: { changeId, name: checkName } },
    });

    if (!check) {
      res.status(404).json({ error: 'Check not found' });
      return;
    }

    if (checkName === 'lint') {
      const updated = await prisma.check.update({
        where: { id: check.id },
        data: { status: 'Passed', message: 'All checks passed' },
      });
      res.json({ check: updated });
      return;
    }

    await prisma.check.update({
      where: { id: check.id },
      data: { status: 'Running', message: 'Running...' },
    });

    setTimeout(async () => {
      const passed = Math.random() > 0.3;
      await prisma.check.update({
        where: { id: check.id },
        data: {
          status: passed ? 'Passed' : 'Failed',
          message: passed ? 'All tests passed' : 'Some tests failed',
        },
      });
    }, 2000);

    res.json({ check: { ...check, status: 'Running' } });
  })
);

export default router;
