import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';

type RateRecord = {
  count: number;
  resetAt: number;
};

const bucket = new Map<string, RateRecord>();

export const rateLimit = (request: Request, response: Response, next: NextFunction) => {
  if (env.NODE_ENV === 'development') {
    next();
    return;
  }

  const key = request.ip ?? 'unknown';
  const now = Date.now();
  const current = bucket.get(key);

  if (!current || current.resetAt < now) {
    bucket.set(key, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS
    });
    next();
    return;
  }

  if (current.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    response.status(429).json({
      status: 'ERROR',
      message: 'تعداد درخواست‌ها بیش از حد مجاز است.',
      englishMessage: 'Too many requests'
    });
    return;
  }

  current.count += 1;
  bucket.set(key, current);
  next();
};

