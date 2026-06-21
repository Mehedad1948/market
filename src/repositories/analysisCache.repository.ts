import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type {
  CompositeBias,
  CompositeEntryTiming,
  CompositeSignalAction,
  StockAnalysisCacheSummary,
  StockAnalysisResult
} from '../types';

const toNumber = (
  value: Prisma.Decimal | number | string | null
): number | null => {
  if (value === null) {
    return null;
  }

  return Number(value);
};

export const extractAnalysisCacheSummary = (result: StockAnalysisResult) => {
  return {
    action: result.signals.composite.action.value,
    score: result.signals.composite.score,
    bias: result.signals.composite.bias.value,
    entryTiming: result.signals.composite.entryTiming.value,
    latestClosePrice: result.metrics.latestClosePrice,
    latestClosePriceChangePercent: result.metrics.latestClosePriceChangePercent
  };
};

type LatestAnalysisCacheRow = {
  symbol: string;
  latestDataDate: string;
  action: CompositeSignalAction | null;
  score: number | null;
  bias: CompositeBias | null;
  entryTiming: CompositeEntryTiming | null;
  latestClosePrice: Prisma.Decimal | null;
  latestClosePriceChangePercent: Prisma.Decimal | null;
  analyzedAt: Date;
  expiresAt: Date;
  persianSummary: string | null;
  result?: Prisma.JsonValue;
};

const mapLatestAnalysisCacheRow = (
  row: LatestAnalysisCacheRow,
  includeResult: boolean
): StockAnalysisCacheSummary => {
  const parsedResult = row.result as StockAnalysisResult | undefined;
  const summary: StockAnalysisCacheSummary = {
    symbol: row.symbol,
    latestDataDate: row.latestDataDate,
    analyzedAt: row.analyzedAt,
    expiresAt: row.expiresAt,
    action: row.action,
    score: row.score,
    bias: row.bias,
    entryTiming: row.entryTiming,
    latestClosePrice: toNumber(row.latestClosePrice),
    latestClosePriceChangePercent: toNumber(row.latestClosePriceChangePercent),
    persianSummary:
      typeof row.persianSummary === 'string'
        ? row.persianSummary
        : typeof parsedResult?.persianSummary === 'string'
          ? parsedResult.persianSummary
          : null
  };

  if (includeResult && parsedResult) {
    summary.result = parsedResult;
  }

  return summary;
};

export const analysisCacheRepository = {
  async getActiveCache(
    symbol: string,
    paramsHash: string,
    latestDataDate: string
  ) {
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
    const typedResult = result as StockAnalysisResult;
    const summary = extractAnalysisCacheSummary(typedResult);
    const analyzedAt = new Date();

    return prisma.analysisCache.upsert({
      where: {
        symbol_paramsHash_latestDataDate: {
          symbol,
          paramsHash,
          latestDataDate
        }
      },
      update: {
        ...summary,
        result,
        analyzedAt,
        expiresAt
      },
      create: {
        symbol,
        paramsHash,
        latestDataDate,
        ...summary,
        result,
        analyzedAt,
        expiresAt
      }
    });
  },

  async getLatestAnalyses(
    paramsHash: string,
    limit: number,
    offset = 0,
    now = new Date(),
    includeResult = false
  ) {
    const resultSelection = includeResult
      ? Prisma.sql`, latest_per_symbol."result"`
      : Prisma.empty;
    const innerResultSelection = includeResult
      ? Prisma.sql`, "result"`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<LatestAnalysisCacheRow[]>(Prisma.sql`
      SELECT
        latest_per_symbol."symbol",
        latest_per_symbol."latestDataDate",
        latest_per_symbol."action",
        latest_per_symbol."score",
        latest_per_symbol."bias",
        latest_per_symbol."entryTiming",
        latest_per_symbol."latestClosePrice",
        latest_per_symbol."latestClosePriceChangePercent",
        latest_per_symbol."analyzedAt",
        latest_per_symbol."expiresAt",
        latest_per_symbol."persianSummary"
        ${resultSelection}
      FROM (
        SELECT DISTINCT ON ("symbol")
          "symbol",
          "latestDataDate",
          "action",
          "score",
          "bias",
          "entryTiming",
          "latestClosePrice",
          "latestClosePriceChangePercent",
          "analyzedAt",
          "expiresAt",
          "updatedAt",
          "result"->>'persianSummary' AS "persianSummary"
          ${innerResultSelection}
        FROM "AnalysisCache"
        WHERE "paramsHash" = ${paramsHash}
          AND "expiresAt" > ${now}
        ORDER BY "symbol", "analyzedAt" DESC, "updatedAt" DESC
      ) AS latest_per_symbol
      ORDER BY latest_per_symbol."analyzedAt" DESC, latest_per_symbol."symbol" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return rows.map((row) => mapLatestAnalysisCacheRow(row, includeResult));
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
