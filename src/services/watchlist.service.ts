import { Prisma } from '@prisma/client';

import { AppError } from '../middleware/errorHandler';
import { subscriptionService } from './subscription.service';
import { watchlistRepository } from '../repositories/watchlist.repository';
import { alertRuleService } from './alertRule.service';

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

const WATCHLIST_LIMITS_BY_ACCESS = {
  NONE: null,
  TRIAL: null,
  PAID: null
} as const;

const serializeItem = (item: { id: string; symbol: string; createdAt: Date }) => ({
  id: item.id,
  symbol: item.symbol,
  createdAt: item.createdAt
});

export const watchlistService = {
  async listWatchlist(userId: string) {
    const items = await watchlistRepository.listByUserId(userId);

    return items.map(serializeItem);
  },

  async addSymbol(userId: string, rawSymbol: string) {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      throw new AppError('نماد معتبر نیست.', 400, {
        englishMessage: 'Symbol is required'
      });
    }

    const access = await subscriptionService.resolveAccessForUser(userId);
    const limit = WATCHLIST_LIMITS_BY_ACCESS[access.level];
    if (limit !== null) {
      const currentCount = await watchlistRepository.countByUserId(userId);
      if (currentCount >= limit) {
        throw new AppError('ظرفیت واچ‌لیست شما تکمیل شده است.', 403, {
          englishMessage: 'Watchlist limit reached',
          limit,
          accessLevel: access.level
        });
      }
    }

    try {
      const item = await watchlistRepository.create(userId, symbol);
      await alertRuleService.processWatchlistChange({
        userId,
        symbol,
        event: 'ADDED'
      });

      return serializeItem(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('این نماد قبلا در واچ‌لیست ثبت شده است.', 409, {
          englishMessage: 'Symbol already exists in watchlist'
        });
      }

      throw error;
    }
  },

  async removeSymbol(userId: string, rawSymbol: string) {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      throw new AppError('نماد معتبر نیست.', 400, {
        englishMessage: 'Symbol is required'
      });
    }

    const result = await watchlistRepository.deleteByUserIdAndSymbol(userId, symbol);
    if (result.count === 0) {
      throw new AppError('نماد در واچ‌لیست یافت نشد.', 404, {
        englishMessage: 'Watchlist symbol not found'
      });
    }

    await alertRuleService.processWatchlistChange({
      userId,
      symbol,
      event: 'REMOVED'
    });

    return {
      symbol
    };
  }
};
