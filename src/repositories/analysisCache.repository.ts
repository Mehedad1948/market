import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const analysisCacheRepository = {
  async getActiveCache(symbol: string, paramsHash: string, latestDataDate: string) {
    return prisma.analysisCache.findUnique({
      where: {
        symbol_paramsHash_latestDataDate: {
          symbol,
          paramsHash,
          latestDataDate
        }
      }
    });
  },

  async saveCache(
    symbol: string,
    paramsHash: string,
    latestDataDate: string,
    result: Prisma.InputJsonValue,
    expiresAt: Date
  ) {
    return prisma.analysisCache.upsert({
      where: {
        symbol_paramsHash_latestDataDate: {
          symbol,
          paramsHash,
          latestDataDate
        }
      },
      update: {
        result,
        expiresAt
      },
      create: {
        symbol,
        paramsHash,
        latestDataDate,
        result,
        expiresAt
      }
    });
  },

  async deleteExpired(now = new Date()) {
    return prisma.analysisCache.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });
  },

  async deleteOlderThan(cutoff: Date) {
    return prisma.analysisCache.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    });
  }
};
