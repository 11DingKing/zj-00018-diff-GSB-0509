import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err.message === 'Not Found') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (err.message === 'Forbidden') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (err.message === 'Bad Request') {
    return res.status(400).json({ error: 'Bad request' });
  }

  res.status(500).json({ error: 'Internal server error' });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
