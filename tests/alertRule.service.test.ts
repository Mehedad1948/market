import { AlertRuleScope, AlertRuleType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  listByUserId: vi.fn(),
  create: vi.fn(),
  deleteByIdForUser: vi.fn(),
  findSignalRulesForSymbols: vi.fn(),
  findWatchlistChangeRulesForUser: vi.fn(),
  createDeliveryIfNotExists: vi.fn(),
  markDeliverySent: vi.fn(),
  deleteDelivery: vi.fn(),
  sendToChat: vi.fn()
}));

vi.mock('../src/repositories/alertRule.repository', () => ({
  alertRuleRepository: {
    listByUserId: repositoryMocks.listByUserId,
    create: repositoryMocks.create,
    deleteByIdForUser: repositoryMocks.deleteByIdForUser,
    findSignalRulesForSymbols: repositoryMocks.findSignalRulesForSymbols,
    findWatchlistChangeRulesForUser: repositoryMocks.findWatchlistChangeRulesForUser,
    createDeliveryIfNotExists: repositoryMocks.createDeliveryIfNotExists,
    markDeliverySent: repositoryMocks.markDeliverySent,
    deleteDelivery: repositoryMocks.deleteDelivery
  }
}));

vi.mock('../src/services/telegramNotifier.service', () => ({
  telegramNotifier: {
    sendToChat: repositoryMocks.sendToChat
  }
}));

import { alertRuleService } from '../src/services/alertRule.service';

describe('alertRule.service', () => {
  beforeEach(() => {
    repositoryMocks.listByUserId.mockReset();
    repositoryMocks.create.mockReset();
    repositoryMocks.deleteByIdForUser.mockReset();
    repositoryMocks.findSignalRulesForSymbols.mockReset();
    repositoryMocks.findWatchlistChangeRulesForUser.mockReset();
    repositoryMocks.createDeliveryIfNotExists.mockReset();
    repositoryMocks.markDeliverySent.mockReset();
    repositoryMocks.deleteDelivery.mockReset();
    repositoryMocks.sendToChat.mockReset();
  });

  it('creates a symbol-scoped signal action rule', async () => {
    repositoryMocks.create.mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      type: AlertRuleType.SIGNAL_ACTION,
      scope: AlertRuleScope.SYMBOL,
      symbol: 'FMLI',
      signalAction: 'STRONG_BUY',
      minScore: null,
      watchlistChangeEvent: null,
      enabled: true,
      cooldownMinutes: 0,
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedAt: new Date('2026-06-25T10:00:00.000Z')
    });

    const result = await alertRuleService.createRule({
      userId: 'user-1',
      type: AlertRuleType.SIGNAL_ACTION,
      scope: AlertRuleScope.SYMBOL,
      symbol: 'fmli',
      signalAction: 'strong_buy'
    });

    expect(repositoryMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        symbol: 'FMLI',
        signalAction: 'STRONG_BUY'
      })
    );
    expect(result).toMatchObject({
      id: 'rule-1',
      symbol: 'FMLI',
      signalAction: 'STRONG_BUY'
    });
  });

  it('deduplicates identical signal alerts across scans', async () => {
    repositoryMocks.findSignalRulesForSymbols.mockResolvedValue([
      {
        id: 'rule-1',
        userId: 'user-1',
        type: AlertRuleType.SIGNAL_ACTION,
        scope: AlertRuleScope.ALL_WATCHLIST,
        symbol: null,
        signalAction: 'RISK_SELL',
        minScore: null,
        enabled: true,
        cooldownMinutes: 0,
        user: {
          id: 'user-1',
          telegramUserId: 'bale-chat-1'
        }
      }
    ]);
    repositoryMocks.createDeliveryIfNotExists
      .mockResolvedValueOnce({
        id: 'delivery-1'
      })
      .mockResolvedValueOnce(null);
    repositoryMocks.sendToChat.mockResolvedValue(true);
    repositoryMocks.markDeliverySent.mockResolvedValue({});

    const first = await alertRuleService.processSignalScanSummary({
      status: 'OK',
      scannedAt: '2026-06-25T10:00:00.000Z',
      symbolsRequested: 1,
      scannedCount: 1,
      okCount: 1,
      insufficientDataCount: 0,
      errorCount: 0,
      results: [
        {
          symbol: 'FMLI',
          status: 'OK',
          action: 'RISK_SELL',
          score: -35,
          latestDataDate: '1405-04-04'
        }
      ]
    });

    const second = await alertRuleService.processSignalScanSummary({
      status: 'OK',
      scannedAt: '2026-06-25T10:05:00.000Z',
      symbolsRequested: 1,
      scannedCount: 1,
      okCount: 1,
      insufficientDataCount: 0,
      errorCount: 0,
      results: [
        {
          symbol: 'FMLI',
          status: 'OK',
          action: 'RISK_SELL',
          score: -35,
          latestDataDate: '1405-04-04'
        }
      ]
    });

    expect(first).toMatchObject({
      matchedRuleCount: 1,
      sentCount: 1,
      deduplicatedCount: 0
    });
    expect(second).toMatchObject({
      matchedRuleCount: 1,
      sentCount: 0,
      deduplicatedCount: 1
    });
    expect(repositoryMocks.sendToChat).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.markDeliverySent).toHaveBeenCalledWith('delivery-1');
  });
});
