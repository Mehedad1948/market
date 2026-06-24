import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { sortByDateAsc } from '../utils/dateSort';

const WRITE_CHUNK_SIZE = 500;

const chunkRows = <T>(rows: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
};

export type BacktestReportSnapshotFilters = {
  runId: string;
  symbols?: string[];
  dateFrom?: string;
  dateTo?: string;
  sectorName?: string;
  compositeAction?: string;
  compositeBias?: string;
  entryTiming?: string;
  liquidityBucket?: string;
  volatilityRegime?: string;
  timeframe?: 'midTerm' | 'longTerm';
  forNewPosition?: string;
  forExistingPosition?: string;
  minScore?: number;
  maxScore?: number;
};

const buildIntRange = (
  minScore?: number,
  maxScore?: number
): Prisma.IntFilter<'BacktestSignalSnapshot'> => {
  const range: Prisma.IntFilter<'BacktestSignalSnapshot'> = {};

  if (minScore !== undefined) {
    range.gte = minScore;
  }

  if (maxScore !== undefined) {
    range.lte = maxScore;
  }

  return range;
};

const buildStringRange = (
  dateFrom?: string,
  dateTo?: string
): Prisma.StringFilter<'BacktestSignalSnapshot'> => {
  const range: Prisma.StringFilter<'BacktestSignalSnapshot'> = {};

  if (dateFrom !== undefined) {
    range.gte = dateFrom;
  }

  if (dateTo !== undefined) {
    range.lte = dateTo;
  }

  return range;
};

const buildTimeframeFilter = (
  filters: BacktestReportSnapshotFilters
): Prisma.BacktestSignalSnapshotWhereInput[] => {
  if (filters.timeframe === 'midTerm') {
    const filter: Prisma.BacktestSignalSnapshotWhereInput = {};
    if (filters.forNewPosition) {
      filter.midForNewPosition = filters.forNewPosition;
    }
    if (filters.forExistingPosition) {
      filter.midForExistingPosition = filters.forExistingPosition;
    }
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      filter.midScore = buildIntRange(filters.minScore, filters.maxScore);
    }

    return Object.keys(filter).length > 0 ? [filter] : [];
  }

  if (filters.timeframe === 'longTerm') {
    const filter: Prisma.BacktestSignalSnapshotWhereInput = {};
    if (filters.forNewPosition) {
      filter.longForNewPosition = filters.forNewPosition;
    }
    if (filters.forExistingPosition) {
      filter.longForExistingPosition = filters.forExistingPosition;
    }
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      filter.longScore = buildIntRange(filters.minScore, filters.maxScore);
    }

    return Object.keys(filter).length > 0 ? [filter] : [];
  }

  const timeframeOr: Prisma.BacktestSignalSnapshotWhereInput[] = [];

  if (filters.forNewPosition) {
    timeframeOr.push(
      { midForNewPosition: filters.forNewPosition },
      { longForNewPosition: filters.forNewPosition }
    );
  }

  if (filters.forExistingPosition) {
    timeframeOr.push(
      { midForExistingPosition: filters.forExistingPosition },
      { longForExistingPosition: filters.forExistingPosition }
    );
  }

  return timeframeOr;
};

const buildSnapshotWhere = (
  filters: BacktestReportSnapshotFilters
): Prisma.BacktestSignalSnapshotWhereInput => {
  const baseFilter: Prisma.BacktestSignalSnapshotWhereInput = {
    runId: filters.runId
  };

  if (filters.symbols && filters.symbols.length > 0) {
    baseFilter.symbol = { in: filters.symbols };
  }

  if (filters.dateFrom !== undefined || filters.dateTo !== undefined) {
    baseFilter.asOfDate = buildStringRange(filters.dateFrom, filters.dateTo);
  }

  if (filters.sectorName) baseFilter.sectorName = filters.sectorName;
  if (filters.compositeAction) {
    baseFilter.compositeAction = filters.compositeAction;
  }
  if (filters.compositeBias) baseFilter.compositeBias = filters.compositeBias;
  if (filters.entryTiming) {
    baseFilter.compositeEntryTiming = filters.entryTiming;
  }
  if (filters.liquidityBucket) {
    baseFilter.liquidityBucket = filters.liquidityBucket;
  }
  if (filters.volatilityRegime) {
    baseFilter.atrVolatilityRegime = filters.volatilityRegime;
  }

  const andFilters: Prisma.BacktestSignalSnapshotWhereInput[] = [baseFilter];

  if (!filters.timeframe && (filters.minScore !== undefined || filters.maxScore !== undefined)) {
    andFilters.push({
      compositeScore: buildIntRange(filters.minScore, filters.maxScore)
    });
  }

  const timeframeFilters = buildTimeframeFilter(filters);
  if (timeframeFilters.length === 1) {
    andFilters.push(timeframeFilters[0]!);
  } else if (timeframeFilters.length > 1) {
    andFilters.push({ OR: timeframeFilters });
  }

  return { AND: andFilters };
};

export const backtestRepository = {
  async createRun(params: Prisma.BacktestRunUncheckedCreateInput) {
    return prisma.backtestRun.create({
      data: params
    });
  },

  async updateRun(id: string, data: Prisma.BacktestRunUpdateInput) {
    return prisma.backtestRun.update({
      where: { id },
      data
    });
  },

  async getRun(id: string) {
    return prisma.backtestRun.findUnique({
      where: { id }
    });
  },

  async getLatestCompletedRun(filters?: {
    scoringVersion?: number;
    paramsHash?: string;
  }) {
    const where: Prisma.BacktestRunWhereInput = {
      status: 'COMPLETED'
    };

    if (filters?.scoringVersion !== undefined) {
      where.scoringVersion = filters.scoringVersion;
    }

    if (filters?.paramsHash !== undefined) {
      where.paramsHash = filters.paramsHash;
    }

    return prisma.backtestRun.findFirst({
      where,
      orderBy: {
        startedAt: 'desc'
      }
    });
  },

  async listSymbols(symbols?: string[], maxSymbols?: number) {
    const args: Prisma.SymbolFindManyArgs = {
      where:
        symbols && symbols.length > 0
          ? {
              symbol: {
                in: symbols
              }
            }
          : {
              isActive: true
      },
      orderBy: {
        symbol: 'asc'
      },
      select: {
        symbol: true,
        sectorId: true,
        sectorName: true,
        displaySector: true
      }
    };

    if (maxSymbols !== undefined) {
      args.take = maxSymbols;
    }

    const rows = await prisma.symbol.findMany(args);

    return rows;
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

  async saveSnapshots(rows: Prisma.BacktestSignalSnapshotCreateManyInput[]) {
    if (rows.length === 0) {
      return 0;
    }

    let count = 0;
    for (const chunk of chunkRows(rows, WRITE_CHUNK_SIZE)) {
      const result = await prisma.backtestSignalSnapshot.createMany({
        data: chunk,
        skipDuplicates: true
      });
      count += result.count;
    }

    return count;
  },

  async countSnapshots(filters: BacktestReportSnapshotFilters) {
    return prisma.backtestSignalSnapshot.count({
      where: buildSnapshotWhere(filters)
    });
  },

  async getSnapshots(filters: BacktestReportSnapshotFilters, limit: number) {
    return prisma.backtestSignalSnapshot.findMany({
      where: buildSnapshotWhere(filters),
      orderBy: [
        {
          asOfDate: 'asc'
        },
        {
          symbol: 'asc'
        }
      ],
      take: limit
    });
  }
};
