import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { notifyCommentAdded, invalidateChangeCache } from '../services/notification';

const router = Router();

const createCommentSchema = z.object({
  diffFileId: z.string().optional(),
  parentId: z.string().optional(),
  content: z.string().min(1),
  lineNumber: z.number().int().positive().optional(),
  side: z.enum(['left', 'right']).optional(),
});

const resolveCommentSchema = z.object({
  resolved: z.boolean(),
});

router.post(
  '/:changeId/comments',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createCommentSchema.parse(req.body);
    const changeId = req.params.changeId;
    const authorId = req.userId!;

    const change = await prisma.change.findUnique({ where: { id: changeId } });
    if (!change) {
      res.status(404).json({ error: 'Change not found' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        changeId,
        diffFileId: body.diffFileId,
        parentId: body.parentId,
        authorId,
        content: body.content,
        lineNumber: body.lineNumber,
        side: body.side,
      },
      include: {
        author: { select: { id: true, username: true, name: true } },
        children: {
          include: { author: { select: { id: true, username: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await notifyCommentAdded(changeId, comment.id, authorId);
    await invalidateChangeCache();
    res.json({ comment });
  })
);

router.get(
  '/:changeId/comments',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { cursor, limit = 50 } = req.query;

    const comments = await prisma.comment.findMany({
      take: Number(limit),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      where: {
        changeId: req.params.changeId,
        parentId: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, name: true } },
        children: {
          include: { author: { select: { id: true, username: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({
      comments,
      nextCursor: comments.length === Number(limit) ? comments[comments.length - 1].id : null,
    });
  })
);

router.put(
  '/:changeId/comments/:commentId/resolve',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = resolveCommentSchema.parse(req.body);

    const comment = await prisma.comment.findUnique({
      where: { id: req.params.commentId },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const updated = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { resolved: body.resolved },
      include: {
        author: { select: { id: true, username: true, name: true } },
      },
    });

    res.json({ comment: updated });
  })
);

export default router;
