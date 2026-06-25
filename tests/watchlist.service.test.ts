import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  listByUserId: vi.fn(),
  countByUserId: vi.fn(),
  create: vi.fn(),
  deleteByUserIdAndSymbol: vi.fn(),
  resolveAccessForUser: vi.fn(),
  processWatchlistChange: vi.fn()
}));

vi.mock('../src/repositories/watchlist.repository', () => ({
  watchlistRepository: {
    listByUserId: repositoryMocks.listByUserId,
    countByUserId: repositoryMocks.countByUserId,
    create: repositoryMocks.create,
    deleteByUserIdAndSymbol: repositoryMocks.deleteByUserIdAndSymbol
  }
}));

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    resolveAccessForUser: repositoryMocks.resolveAccessForUser
  }
}));

vi.mock('../src/services/alertRule.service', () => ({
  alertRuleService: {
    processWatchlistChange: repositoryMocks.processWatchlistChange
  }
}));

import { watchlistService } from '../src/services/watchlist.service';

describe('watchlist.service', () => {
  beforeEach(() => {
    repositoryMocks.listByUserId.mockReset();
    repositoryMocks.countByUserId.mockReset();
    repositoryMocks.create.mockReset();
    repositoryMocks.deleteByUserIdAndSymbol.mockReset();
    repositoryMocks.resolveAccessForUser.mockReset();
    repositoryMocks.processWatchlistChange.mockReset();

    repositoryMocks.resolveAccessForUser.mockResolvedValue({
      userId: 'user-1',
      trialUsed: false,
      hasAccess: false,
      level: 'NONE',
      reason: 'NO_SUBSCRIPTION',
      subscription: null
    });
  });

  it('lists user watchlist items', async () => {
    repositoryMocks.listByUserId.mockResolvedValue([
      {
        id: 'watch-1',
        symbol: 'FMLI',
        createdAt: new Date('2026-06-25T10:00:00.000Z')
      }
    ]);

    const result = await watchlistService.listWatchlist('user-1');

    expect(result).toMatchObject([
      {
        id: 'watch-1',
        symbol: 'FMLI'
      }
    ]);
  });

  it('normalizes and adds a unique symbol', async () => {
    repositoryMocks.create.mockResolvedValue({
      id: 'watch-1',
      symbol: 'FMLI',
      createdAt: new Date('2026-06-25T10:00:00.000Z')
    });

    const result = await watchlistService.addSymbol('user-1', ' fmli ');

    expect(repositoryMocks.create).toHaveBeenCalledWith('user-1', 'FMLI');
    expect(repositoryMocks.processWatchlistChange).toHaveBeenCalledWith({
      userId: 'user-1',
      symbol: 'FMLI',
      event: 'ADDED'
    });
    expect(result).toMatchObject({
      symbol: 'FMLI'
    });
  });

  it('rejects duplicate symbols with a service-level conflict', async () => {
    repositoryMocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );

    await expect(watchlistService.addSymbol('user-1', 'FMLI')).rejects.toMatchObject({
      statusCode: 409,
      payload: {
        englishMessage: 'Symbol already exists in watchlist'
      }
    });
  });

  it('removes a symbol for a single user scope', async () => {
    repositoryMocks.deleteByUserIdAndSymbol.mockResolvedValue({
      count: 1
    });

    const result = await watchlistService.removeSymbol('user-1', 'fmli');

    expect(repositoryMocks.deleteByUserIdAndSymbol).toHaveBeenCalledWith('user-1', 'FMLI');
    expect(repositoryMocks.processWatchlistChange).toHaveBeenCalledWith({
      userId: 'user-1',
      symbol: 'FMLI',
      event: 'REMOVED'
    });
    expect(result).toEqual({
      symbol: 'FMLI'
    });
  });
});
