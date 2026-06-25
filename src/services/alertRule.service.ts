import {
  AlertRuleScope,
  AlertRuleType,
  WatchlistChangeEvent,
  type AlertRule
} from '@prisma/client';

import { AppError } from '../middleware/errorHandler';
import { alertRuleRepository } from '../repositories/alertRule.repository';
import type { SignalScanSummary } from './signalScan.service';
import { telegramNotifier } from './telegramNotifier.service';

type CreateAlertRuleInput = {
  userId: string;
  type: AlertRuleType;
  scope?: AlertRuleScope;
  symbol?: string | null;
  signalAction?: string | null;
  minScore?: number | null;
  watchlistChangeEvent?: WatchlistChangeEvent | null;
  enabled?: boolean;
  cooldownMinutes?: number;
};

const normalizeSymbol = (symbol: string | null | undefined) => {
  if (typeof symbol !== 'string') {
    return null;
  }

  const normalized = symbol.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const serializeRule = (rule: AlertRule) => ({
  id: rule.id,
  type: rule.type,
  scope: rule.scope,
  symbol: rule.symbol,
  signalAction: rule.signalAction,
  minScore: rule.minScore,
  watchlistChangeEvent: rule.watchlistChangeEvent,
  enabled: rule.enabled,
  cooldownMinutes: rule.cooldownMinutes,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt
});

const validateRuleInput = (input: CreateAlertRuleInput) => {
  const scope = input.scope ?? AlertRuleScope.ALL_WATCHLIST;
  const symbol = normalizeSymbol(input.symbol);

  if (scope === AlertRuleScope.SYMBOL && !symbol) {
    throw new AppError('برای این قانون باید نماد مشخص شود.', 400, {
      englishMessage: 'Symbol is required for symbol-scoped alert rules'
    });
  }

  if (input.type === AlertRuleType.WATCHLIST_CHANGE) {
    if (!input.watchlistChangeEvent) {
      throw new AppError('نوع تغییر واچ‌لیست باید مشخص شود.', 400, {
        englishMessage: 'Watchlist change event is required'
      });
    }
  }

  if (input.type === AlertRuleType.SIGNAL_ACTION) {
    const signalAction = input.signalAction?.trim().toUpperCase() ?? null;
    if (!signalAction) {
      throw new AppError('اکشن سیگنال باید مشخص شود.', 400, {
        englishMessage: 'Signal action is required'
      });
    }

    return {
      scope,
      symbol,
      signalAction,
      minScore: null,
      watchlistChangeEvent: null
    };
  }

  if (input.type === AlertRuleType.SIGNAL_SCORE) {
    if (
      typeof input.minScore !== 'number' ||
      !Number.isInteger(input.minScore) ||
      input.minScore < -100 ||
      input.minScore > 100
    ) {
      throw new AppError('حداقل امتیاز باید بین ۱۰۰- تا ۱۰۰ باشد.', 400, {
        englishMessage: 'Minimum score must be an integer between -100 and 100'
      });
    }

    return {
      scope,
      symbol,
      signalAction: null,
      minScore: input.minScore,
      watchlistChangeEvent: null
    };
  }

  return {
    scope,
    symbol,
    signalAction: null,
    minScore: null,
    watchlistChangeEvent: input.watchlistChangeEvent ?? null
  };
};

const buildSignalEventKey = (
  rule: {
    id: string;
    type: AlertRuleType;
    signalAction: string | null;
    minScore: number | null;
  },
  item: {
    symbol: string;
    latestDataDate: string | null;
    action: string | null;
    score: number | null;
  }
) => {
  if (rule.type === AlertRuleType.SIGNAL_ACTION) {
    return `signal-action:${item.symbol}:${item.latestDataDate ?? 'unknown'}:${rule.signalAction ?? 'NONE'}`;
  }

  return `signal-score:${item.symbol}:${item.latestDataDate ?? 'unknown'}:${rule.minScore ?? 'NONE'}:${item.score ?? 'NONE'}`;
};

const buildWatchlistEventKey = (symbol: string, event: WatchlistChangeEvent) => {
  return `watchlist:${event}:${symbol}:${new Date().toISOString()}`;
};

const matchesSignalRule = (
  rule: {
    type: AlertRuleType;
    signalAction: string | null;
    minScore: number | null;
    scope: AlertRuleScope;
    symbol: string | null;
  },
  item: {
    symbol: string;
    action: string | null;
    score: number | null;
  }
) => {
  if (rule.scope === AlertRuleScope.SYMBOL && rule.symbol !== item.symbol) {
    return false;
  }

  if (rule.type === AlertRuleType.SIGNAL_ACTION) {
    return item.action !== null && rule.signalAction === item.action;
  }

  if (rule.type === AlertRuleType.SIGNAL_SCORE) {
    return item.score !== null && rule.minScore !== null && item.score >= rule.minScore;
  }

  return false;
};

export const alertRuleService = {
  async listRules(userId: string) {
    const rules = await alertRuleRepository.listByUserId(userId);
    return rules.map(serializeRule);
  },

  async createRule(input: CreateAlertRuleInput) {
    const normalized = validateRuleInput(input);
    const rule = await alertRuleRepository.create({
      userId: input.userId,
      type: input.type,
      scope: normalized.scope,
      symbol: normalized.symbol,
      signalAction: normalized.signalAction,
      minScore: normalized.minScore,
      watchlistChangeEvent: normalized.watchlistChangeEvent,
      enabled: input.enabled ?? true,
      cooldownMinutes: input.cooldownMinutes ?? 0
    });

    return serializeRule(rule);
  },

  async deleteRule(userId: string, ruleId: string) {
    const result = await alertRuleRepository.deleteByIdForUser(ruleId, userId);
    if (result.count === 0) {
      throw new AppError('قانون هشدار یافت نشد.', 404, {
        englishMessage: 'Alert rule not found'
      });
    }

    return {
      id: ruleId
    };
  },

  async processWatchlistChange(input: {
    userId: string;
    symbol: string;
    event: WatchlistChangeEvent;
  }) {
    const rules = await alertRuleRepository.findWatchlistChangeRulesForUser(
      input.userId,
      input.event
    );

    for (const rule of rules) {
      if (
        rule.scope === AlertRuleScope.SYMBOL &&
        rule.symbol !== null &&
        rule.symbol !== input.symbol
      ) {
        continue;
      }

      if (!rule.user.telegramUserId) {
        continue;
      }

      const delivery = await alertRuleRepository.createDeliveryIfNotExists({
        userId: rule.userId,
        alertRuleId: rule.id,
        symbol: input.symbol,
        eventKey: buildWatchlistEventKey(input.symbol, input.event),
        sent: false,
        payload: {
          type: 'WATCHLIST_CHANGE',
          event: input.event,
          symbol: input.symbol
        }
      });

      if (!delivery) {
        continue;
      }

      const sent = await telegramNotifier.sendToChat(
        rule.user.telegramUserId,
        'Watchlist updated',
        {
          symbol: input.symbol,
          event: input.event,
          ruleId: rule.id
        }
      );

      if (sent) {
        await alertRuleRepository.markDeliverySent(delivery.id);
        continue;
      }

      await alertRuleRepository.deleteDelivery(delivery.id);
    }
  },

  async processSignalScanSummary(summary: SignalScanSummary) {
    const okResults = summary.results.filter(
      (item) => item.status === 'OK' && item.symbol.length > 0
    );
    if (okResults.length === 0) {
      return {
        matchedRuleCount: 0,
        sentCount: 0,
        deduplicatedCount: 0
      };
    }

    const symbols = [...new Set(okResults.map((item) => item.symbol))];
    const rules = await alertRuleRepository.findSignalRulesForSymbols(symbols);

    let matchedRuleCount = 0;
    let sentCount = 0;
    let deduplicatedCount = 0;

    for (const rule of rules) {
      if (!rule.user.telegramUserId) {
        continue;
      }

      for (const item of okResults) {
        if (!matchesSignalRule(rule, item)) {
          continue;
        }

        matchedRuleCount += 1;
        const delivery = await alertRuleRepository.createDeliveryIfNotExists({
          userId: rule.userId,
          alertRuleId: rule.id,
          symbol: item.symbol,
          eventKey: buildSignalEventKey(rule, item),
          sent: false,
          payload: {
            type: rule.type,
            symbol: item.symbol,
            action: item.action,
            score: item.score,
            latestDataDate: item.latestDataDate,
            scannedAt: summary.scannedAt
          }
        });

        if (!delivery) {
          deduplicatedCount += 1;
          continue;
        }

        const sent = await telegramNotifier.sendToChat(
          rule.user.telegramUserId,
          'Watchlist signal alert',
          {
            symbol: item.symbol,
            action: item.action,
            score: item.score,
            latestDataDate: item.latestDataDate,
            scannedAt: summary.scannedAt,
            ruleId: rule.id,
            ruleType: rule.type
          }
        );

        if (sent) {
          await alertRuleRepository.markDeliverySent(delivery.id);
          sentCount += 1;
          continue;
        }

        await alertRuleRepository.deleteDelivery(delivery.id);
      }
    }

    return {
      matchedRuleCount,
      sentCount,
      deduplicatedCount
    };
  }
};
