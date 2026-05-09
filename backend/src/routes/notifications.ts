import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import redis from '../lib/redis';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { cursor, limit = 20, unread } = req.query;

    const where: any = { userId };
    if (unread === 'true') where.read = false;

    const notifications = await prisma.notification.findMany({
      take: Number(limit),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      notifications,
      nextCursor: notifications.length === Number(limit) ? notifications[notifications.length - 1].id : null,
    });
  })
);

router.get(
  '/unread-count',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const cacheKey = `unread:${userId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json({ count: parseInt(cached) });
      return;
    }

    const count = await prisma.notification.count({
      where: { userId, read: false },
    });

    await redis.set(cacheKey, count.toString(), 'EX', 30);
    res.json({ count });
  })
);

router.post(
  '/:id/read',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== userId) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    await redis.del(`unread:${userId}`);
    res.json({ success: true });
  })
);

router.post(
  '/read-all',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    await redis.del(`unread:${userId}`);
    res.json({ success: true });
  })
);

export default router;
