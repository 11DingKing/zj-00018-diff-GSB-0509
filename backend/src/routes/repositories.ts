import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  branches: z.array(z.string()).default(['main', 'develop']),
});

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createRepoSchema.parse(req.body);

    const existing = await prisma.repository.findUnique({
      where: { name: body.name },
    });
    if (existing) {
      res.status(400).json({ error: 'Repository already exists' });
      return;
    }

    const repo = await prisma.repository.create({
      data: {
        name: body.name,
        description: body.description,
        branches: {
          create: body.branches.map((name) => ({ name })),
        },
      },
      include: {
        branches: { select: { id: true, name: true } },
      },
    });

    res.json({ repository: repo });
  })
);

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { cursor, limit = 20 } = req.query;

    const repos = await prisma.repository.findMany({
      take: Number(limit),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        branches: { select: { id: true, name: true } },
        _count: { select: { changes: true } },
      },
    });

    res.json({
      repositories: repos,
      nextCursor: repos.length === Number(limit) ? repos[repos.length - 1].id : null,
    });
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const repo = await prisma.repository.findUnique({
      where: { id: req.params.id },
      include: {
        branches: { select: { id: true, name: true } },
        _count: { select: { changes: true } },
      },
    });
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    res.json({ repository: repo });
  })
);

export default router;
