import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { requireAuthenticatedUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { watchlistService } from '../services/watchlist.service';

const watchlistBodySchema = z.object({
  symbol: z.string().trim().min(1)
});

const getRouteSymbol = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

export const listWatchlist = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const items = await watchlistService.listWatchlist(user.id);

    response.json({
      status: 'OK',
      items
    });
  } catch (error) {
    next(error);
  }
};

export const addWatchlistSymbol = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const parsed = watchlistBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست واچ‌لیست معتبر نیست.', 400, {
        englishMessage: 'Invalid watchlist payload',
        issues: parsed.error.flatten()
      });
    }

    const item = await watchlistService.addSymbol(user.id, parsed.data.symbol);
    response.status(201).json({
      status: 'OK',
      item
    });
  } catch (error) {
    next(error);
  }
};

export const removeWatchlistSymbol = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const symbol = getRouteSymbol(request.params.symbol);
    const removed = await watchlistService.removeSymbol(user.id, symbol);

    response.json({
      status: 'OK',
      removed
    });
  } catch (error) {
    next(error);
  }
};
