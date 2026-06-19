import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { sortByDateAsc } from '../utils/dateSort';

const WRITE_CHUNK_SIZE = 250;

const chunkRows = <T>(rows: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
};

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

    const symbol = rows[0]!.symbol;
    const chunks = chunkRows(rows, WRITE_CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      await tx.symbolDailyMetric.deleteMany({
        where: { symbol }
      });

      for (const chunk of chunks) {
        await tx.symbolDailyMetric.createMany({
          data: chunk
        });
      }
    });
  },

  async upsertRealLegalRows(rows: Prisma.SymbolRealLegalDailyUncheckedCreateInput[]) {
    if (rows.length === 0) {
      return;
    }

    const symbol = rows[0]!.symbol;
    const chunks = chunkRows(rows, WRITE_CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      await tx.symbolRealLegalDaily.deleteMany({
        where: { symbol }
      });

      for (const chunk of chunks) {
        await tx.symbolRealLegalDaily.createMany({
          data: chunk
        });
      }
    });
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
