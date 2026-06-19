import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { sortByDateAsc } from '../utils/dateSort';

export const symbolRepository = {
  async upsertSymbol(symbol: string, name?: string | null) {
    return prisma.symbol.upsert({
      where: { symbol },
      update: name === undefined ? {} : { name },
      create: { symbol, name: name ?? null }
    });
  },

  async upsertDailyMetrics(rows: Prisma.SymbolDailyMetricUncheckedCreateInput[]) {
    if (rows.length === 0) {
      return;
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.symbolDailyMetric.upsert({
          where: {
            symbol_date: {
              symbol: row.symbol,
              date: row.date
            }
          },
          update: row,
          create: row
        })
      )
    );
  },

  async upsertRealLegalRows(rows: Prisma.SymbolRealLegalDailyUncheckedCreateInput[]) {
    if (rows.length === 0) {
      return;
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.symbolRealLegalDaily.upsert({
          where: {
            symbol_date: {
              symbol: row.symbol,
              date: row.date
            }
          },
          update: row,
          create: row
        })
      )
    );
  },

  async getSymbolHistory(symbol: string) {
    const rows = await prisma.symbolDailyMetric.findMany({
      where: { symbol },
      orderBy: {
        date: 'asc'
      }
    });

    return sortByDateAsc(rows);
  },

  async getTrackedSymbols() {
    const rows = await prisma.symbol.findMany({
      orderBy: {
        symbol: 'asc'
      }
    });

    return rows.map((row) => row.symbol);
  },

  async getPaginatedHistory(symbol: string, limit: number, offset: number) {
    return prisma.symbolDailyMetric.findMany({
      where: { symbol },
      orderBy: {
        date: 'desc'
      },
      skip: offset,
      take: limit
    });
  },

  async getLatestMetric(symbol: string) {
    const rows = await prisma.symbolDailyMetric.findMany({
      where: { symbol },
      orderBy: {
        date: 'desc'
      },
      take: 1
    });

    return rows[0] ?? null;
  },

  async createAnalysisRequest(params: Prisma.AnalysisRequestUncheckedCreateInput) {
    return prisma.analysisRequest.create({
      data: params
    });
  }
};
