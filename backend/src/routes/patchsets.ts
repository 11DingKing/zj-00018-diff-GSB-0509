import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { invalidateChangeCache } from '../services/notification';

const router = Router();

const createPatchsetSchema = z.object({
  message: z.string().optional(),
  diffs: z.array(
    z.object({
      filePath: z.string(),
      diffText: z.string(),
      status: z.enum(['added', 'modified', 'deleted', 'renamed']),
    })
  ),
});

const voteSchema = z.object({
  value: z.enum(['V2_NEG', 'V1_NEG', 'V0', 'V1_POS', 'V2_POS']),
});

router.post(
  '/:changeId/patchsets',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createPatchsetSchema.parse(req.body);
    const changeId = req.params.changeId;

    const change = await prisma.change.findUnique({
      where: { id: changeId },
      include: { patchsets: { orderBy: { number: 'desc' }, take: 1 } },
    });

    if (!change) {
      res.status(404).json({ error: 'Change not found' });
      return;
    }

    if (change.authorId !== req.userId) {
      res.status(403).json({ error: 'Only author can add patchsets' });
      return;
    }

    const nextNumber = (change.patchsets[0]?.number || 0) + 1;

    const patchset = await prisma.patchset.create({
      data: {
        changeId,
        number: nextNumber,
        message: body.message,
        diffFiles: {
          create: body.diffs.map((d) => ({
            filePath: d.filePath,
            diffText: d.diffText,
            status: d.status,
          })),
        },
      },
      include: { diffFiles: true },
    });

    await invalidateChangeCache();
    res.json({ patchset });
  })
);

router.get(
  '/:changeId/patchsets/:number',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patchset = await prisma.patchset.findFirst({
      where: {
        changeId: req.params.changeId,
        number: Number(req.params.number),
      },
      include: {
        diffFiles: {
          include: {
            comments: {
              include: { author: { select: { id: true, username: true, name: true } } },
            },
          },
        },
        votes: { include: { user: { select: { id: true, username: true, name: true } } } },
      },
    });

    if (!patchset) {
      res.status(404).json({ error: 'Patchset not found' });
      return;
    }

    res.json({ patchset });
  })
);

router.post(
  '/:changeId/patchsets/:number/vote',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = voteSchema.parse(req.body);
    const { changeId, number } = req.params;
    const userId = req.userId!;

    const patchset = await prisma.patchset.findFirst({
      where: { changeId, number: Number(number) },
      include: { change: true },
    });

    if (!patchset) {
      res.status(404).json({ error: 'Patchset not found' });
      return;
    }

    if (body.value === 'V2_POS' && patchset.change.authorId === userId) {
      res.status(400).json({ error: 'Author cannot vote +2 on their own change' });
      return;
    }

    const existingVote = await prisma.vote.findUnique({
      where: {
        changeId_patchsetId_userId: {
          changeId,
          patchsetId: patchset.id,
          userId,
        },
      },
    });

    let vote;
    if (existingVote) {
      vote = await prisma.vote.update({
        where: { id: existingVote.id },
        data: { value: body.value as any },
        include: { user: { select: { id: true, username: true, name: true } } },
      });
    } else {
      vote = await prisma.vote.create({
        data: {
          changeId,
          patchsetId: patchset.id,
          userId,
          value: body.value as any,
        },
        include: { user: { select: { id: true, username: true, name: true } } },
      });
    }

    const { notifyVoteChanged } = await import('../services/notification');
    await notifyVoteChanged(changeId, userId, body.value);
    await invalidateChangeCache();
    res.json({ vote });
  })
);

export default router;
