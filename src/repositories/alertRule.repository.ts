import {
  AlertRuleScope,
  AlertRuleType,
  Prisma,
  WatchlistChangeEvent
} from '@prisma/client';

import { prisma } from '../lib/prisma';

export const alertRuleRepository = {
  async listByUserId(userId: string) {
    return prisma.alertRule.findMany({
      where: {
        userId
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  },

  async create(data: Prisma.AlertRuleUncheckedCreateInput) {
    return prisma.alertRule.create({
      data
    });
  },

  async deleteByIdForUser(id: string, userId: string) {
    return prisma.alertRule.deleteMany({
      where: {
        id,
        userId
      }
    });
  },

  async findSignalRulesForSymbols(symbols: string[]) {
    return prisma.alertRule.findMany({
      where: {
        enabled: true,
        type: {
          in: [AlertRuleType.SIGNAL_ACTION, AlertRuleType.SIGNAL_SCORE]
        },
        OR: [
          {
            scope: AlertRuleScope.SYMBOL,
            symbol: {
              in: symbols
            }
          },
          {
            scope: AlertRuleScope.ALL_WATCHLIST,
            user: {
              watchlist: {
                some: {
                  symbol: {
                    in: symbols
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true
          }
        }
      }
    });
  },

  async findWatchlistChangeRulesForUser(
    userId: string,
    event: WatchlistChangeEvent
  ) {
    return prisma.alertRule.findMany({
      where: {
        userId,
        enabled: true,
        type: AlertRuleType.WATCHLIST_CHANGE,
        watchlistChangeEvent: event
      },
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true
          }
        }
      }
    });
  },

  async createDeliveryIfNotExists(data: Prisma.AlertDeliveryUncheckedCreateInput) {
    try {
      return await prisma.alertDelivery.create({
        data
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }

      throw error;
    }
  },

  async markDeliverySent(id: string) {
    return prisma.alertDelivery.update({
      where: {
        id
      },
      data: {
        sent: true,
        sentAt: new Date()
      }
    });
  },

  async deleteDelivery(id: string) {
    return prisma.alertDelivery.delete({
      where: {
        id
      }
    });
  }
};
