import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';
import { symbolRepository } from '../repositories/symbol.repository';
import { analysisCacheRepository } from '../repositories/analysisCache.repository';
import {
  analyzeSymbolMetrics,
  buildAnalysisParamsHash
} from '../services/analysis.service';
import { maintenanceService } from '../services/maintenance.service';
import { signalScanService } from '../services/signalScan.service';
import { symbolDataService } from '../services/symbolData.service';
import type { StockAnalysisResult, SymbolAnalysisParams } from '../types';

const getRouteSymbol = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

const decodeSymbol = (rawSymbol: string): string => {
  try {
    return decodeURIComponent(rawSymbol).trim();
  } catch {
    return rawSymbol.trim();
  }
};

const analysisQuerySchema = z
  .object({
    weeklyWindow: z.coerce
      .number()
      .int()
      .positive()
      .default(env.DEFAULT_WEEKLY_WINDOW),
    monthlyWindow: z.coerce
      .number()
      .int()
      .positive()
      .default(env.DEFAULT_MONTHLY_WINDOW),
    quarterlyWindow: z.coerce
      .number()
      .int()
      .positive()
      .default(env.DEFAULT_QUARTERLY_WINDOW),
    forceRefresh: z.coerce.boolean().default(false),
    includeRealLegal: z.coerce.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (
      !(
        value.weeklyWindow < value.monthlyWindow &&
        value.monthlyWindow < value.quarterlyWindow
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'weeklyWindow < monthlyWindow < quarterlyWindow must hold.'
      });
    }
  });

const refreshBodySchema = z.object({
  includeRealLegal: z.boolean().optional().default(false)
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0)
});

const manualScanBodySchema = z.object({
  symbols: z.array(z.string().trim().min(1)).optional(),
  forceRefresh: z.boolean().optional(),
  includeRealLegal: z.boolean().optional()
});

const buildSource = (refreshed: boolean): 'database' | 'brsapi' => {
  return refreshed ? 'brsapi' : 'database';
};

class DatabaseOperationTimeoutError extends Error {
  operation: string;
  timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Database operation timed out: ${operation} after ${timeoutMs}ms`);
    this.name = 'DatabaseOperationTimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

const withDbTimeout = async <T>(operation: string, task: Promise<T>): Promise<T> => {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new DatabaseOperationTimeoutError(operation, env.DB_OPERATION_TIMEOUT_MS));
      }, env.DB_OPERATION_TIMEOUT_MS);
    })
  ]);
};

export const isDatabaseUnavailableError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof DatabaseOperationTimeoutError
  );
};

export const isHistoryStale = (
  history: Array<{ updatedAt: Date }>,
  now = new Date()
): boolean => {
  if (history.length === 0) {
    return true;
  }

  const latestUpdatedAt = history.reduce((latest, row) => {
    return row.updatedAt > latest ? row.updatedAt : latest;
  }, history[0]!.updatedAt);

  const ageMs = now.getTime() - latestUpdatedAt.getTime();
  const maxAgeMs = isWithinMarketHours(
    now,
    env.MARKET_TIMEZONE,
    env.MARKET_OPEN_TIME,
    env.MARKET_CLOSE_TIME
  )
    ? env.MARKET_HOURS_HISTORY_MAX_AGE_MINUTES * 60 * 1000
    : env.HISTORY_MAX_AGE_HOURS * 60 * 60 * 1000;

  return ageMs >= maxAgeMs;
};

const getMarketClockParts = (now: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? '0'
  );

  return { hour, minute };
};

const parseClockMinutes = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const isWithinMarketHours = (
  now: Date,
  timezone: string,
  openTime: string,
  closeTime: string
): boolean => {
  const { hour, minute } = getMarketClockParts(now, timezone);
  const currentMinutes = hour * 60 + minute;
  const openMinutes = parseClockMinutes(openTime);
  const closeMinutes = parseClockMinutes(closeTime);

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
};

const triggerMaintenanceCleanup = () => {
  void maintenanceService.cleanupAnalysisStorage().catch((error) => {
    logger.warn({ err: error }, 'Analysis storage cleanup failed');
  });
};

const persistRequestLog = async (
  request: Request,
  symbol: string,
  params: unknown,
  cacheHit: boolean,
  dataSource: string,
  status: string
) => {
  await symbolRepository.createAnalysisRequest({
    symbol,
    params: params as never,
    cacheHit,
    dataSource,
    status,
    ip: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null
  });
};

export const getStockAnalysis = async (
  request: Request,
  response: Response
) => {
  const symbol = decodeSymbol(getRouteSymbol(request.params.symbol));
  if (!symbol) {
    throw new AppError('نماد معتبر نیست.', 400, {
      englishMessage: 'Invalid symbol'
    });
  }

  const params = analysisQuerySchema.parse(
    request.query
  ) as SymbolAnalysisParams;
  const requestLog = request.log ?? logger;
  let history = [] as Awaited<ReturnType<typeof symbolRepository.getSymbolHistory>>;
  let databaseAvailable = true;
  let source: 'database' | 'brsapi' = 'database';

  requestLog.info(
    {
      symbol,
      params,
      query: request.query,
      forceRefreshRequested: params.forceRefresh
    },
    '🧠 Analysis request received'
  );

  try {
    history = await withDbTimeout(
      'getSymbolHistory.initial',
      symbolRepository.getSymbolHistory(symbol)
    );
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    databaseAvailable = false;
    requestLog.warn(
      { err: error, symbol },
      '⚠️ Database unavailable, falling back to BrsApi'
    );
  }

  const shouldRefresh =
    params.forceRefresh || !databaseAvailable || isHistoryStale(history);

  requestLog.info(
    {
      symbol,
      databaseAvailable,
      historyRows: history.length,
      shouldRefresh,
      source
    },
    shouldRefresh
      ? '🔄 Refresh path selected for analysis request'
      : '📚 Using cached database history for analysis request'
  );

  if (shouldRefresh) {
    source = 'brsapi';

    if (databaseAvailable) {
      try {
        await withDbTimeout(
          'refreshSymbolHistory',
          symbolDataService.refreshSymbolHistory(
            symbol,
            params.includeRealLegal
          )
        );
        history = await withDbTimeout(
          'getSymbolHistory.afterRefresh',
          symbolRepository.getSymbolHistory(symbol)
        );
      } catch (error) {
        if (!isDatabaseUnavailableError(error)) {
          throw error;
        }

        databaseAvailable = false;
        requestLog.warn(
          { err: error, symbol, timeoutMs: env.DB_OPERATION_TIMEOUT_MS },
          '⚠️ Database refresh/persist path failed or timed out, using live BrsApi analysis'
        );
        history = await symbolDataService.fetchSymbolHistoryFromBrs(
          symbol,
          params.includeRealLegal
        );
      }
    } else {
      history = await symbolDataService.fetchSymbolHistoryFromBrs(
        symbol,
        params.includeRealLegal
      );
    }
  }

  const latestDataDate = history.at(-1)?.date;
  if (!latestDataDate) {
    throw new AppError('داده‌ای برای نماد یافت نشد.', 404, {
      englishMessage: 'No symbol data found'
    });
  }

  const paramsHash = buildAnalysisParamsHash(params);

  if (databaseAvailable && !params.forceRefresh) {
    try {
      const activeCache = await withDbTimeout(
        'analysisCache.getActiveCache',
        analysisCacheRepository.getActiveCache(
          symbol,
          paramsHash,
          latestDataDate
        )
      );

      if (activeCache && activeCache.expiresAt > new Date()) {
        const cachedResult = activeCache.result as StockAnalysisResult;
        const finalResult = {
          ...cachedResult,
          cacheHit: true
        };
        await withDbTimeout(
          'analysisRequest.create.cacheHit',
          persistRequestLog(
            request,
            symbol,
            params,
            true,
            cachedResult.source,
            cachedResult.status
          )
        );
        requestLog.info(
          {
            symbol,
            latestDataDate,
            cacheHit: true,
            cacheStatus: cachedResult.status,
            cacheSource: cachedResult.source
          },
        '⚡ Analysis cache hit'
      );
      triggerMaintenanceCleanup();
      response.json(finalResult);
      return;
      }

      requestLog.info(
        {
          symbol,
          latestDataDate,
          cacheHit: false
        },
        '🗃️ Analysis cache miss'
      );
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }

      databaseAvailable = false;
      requestLog.warn(
        { err: error, symbol },
        '⚠️ Database unavailable during cache lookup, computing from BrsApi data only'
      );
    }
  }

  const result = analyzeSymbolMetrics(
    symbol,
    history,
    params,
    source === 'brsapi' ? 'brsapi' : buildSource(shouldRefresh),
    false
  );

  requestLog.info(
    {
      symbol,
      resultStatus: result.status,
      source: result.source,
      historyRows: history.length,
      latestDataDate
    },
    '📊 Analysis result computed'
  );

  if (databaseAvailable) {
    try {
      const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000);
      await withDbTimeout(
        'analysisCache.saveCache',
        analysisCacheRepository.saveCache(
          symbol,
          paramsHash,
          latestDataDate,
          result,
          expiresAt
        )
      );
      await withDbTimeout(
        'analysisRequest.create.cacheMiss',
        persistRequestLog(
          request,
          symbol,
          params,
          false,
          result.source,
          result.status
        )
      );
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }

      requestLog.warn(
        { err: error, symbol, timeoutMs: env.DB_OPERATION_TIMEOUT_MS },
        '⚠️ Database unavailable during cache save or request logging, returning direct analysis result'
      );
    }
  }

  triggerMaintenanceCleanup();
  response.json(result);
};

export const refreshStockHistory = async (
  request: Request,
  response: Response
) => {
  const symbol = decodeSymbol(getRouteSymbol(request.params.symbol));
  if (!symbol) {
    throw new AppError('نماد معتبر نیست.', 400, {
      englishMessage: 'Invalid symbol'
    });
  }

  const body = refreshBodySchema.parse(request.body ?? {});
  const requestLog = request.log ?? logger;
  requestLog.info(
    { symbol, includeRealLegal: body.includeRealLegal },
    '🔧 Manual refresh requested'
  );
  const refreshResult = await symbolDataService.refreshSymbolHistory(
    symbol,
    body.includeRealLegal
  );
  const latest = await symbolRepository.getLatestMetric(symbol);

  response.json({
    status: 'OK',
    symbol,
    refreshed: true,
    includeRealLegal: body.includeRealLegal,
    rowsUpserted: refreshResult.tradeRows,
    latestDataDate: latest?.date ?? null
  });
};

export const getStockHistory = async (request: Request, response: Response) => {
  const symbol = decodeSymbol(getRouteSymbol(request.params.symbol));
  const query = historyQuerySchema.parse(request.query);
  (request.log ?? logger).info(
    { symbol, query },
    '📜 History request received'
  );

  const rows = await symbolRepository.getPaginatedHistory(
    symbol,
    query.limit,
    query.offset
  );
  response.json({
    status: 'OK',
    symbol,
    limit: query.limit,
    offset: query.offset,
    rows
  });
};

export const getLatestStockMetric = async (
  request: Request,
  response: Response
) => {
  const symbol = decodeSymbol(getRouteSymbol(request.params.symbol));
  (request.log ?? logger).info({ symbol }, '🕒 Latest metric request received');
  const row = await symbolRepository.getLatestMetric(symbol);

  if (!row) {
    throw new AppError('داده‌ای برای نماد یافت نشد.', 404, {
      englishMessage: 'No symbol data found'
    });
  }

  response.json({
    status: 'OK',
    symbol,
    row
  });
};

export const runManualSignalScan = async (
  request: Request,
  response: Response
) => {
  const body = manualScanBodySchema.parse(request.body ?? {});
  (request.log ?? logger).info({ body }, '📡 Manual signal scan requested');
  const options: {
    symbols?: string[];
    forceRefresh?: boolean;
    includeRealLegal?: boolean;
  } = {};

  if (body.symbols !== undefined) {
    options.symbols = body.symbols;
  }

  if (body.forceRefresh !== undefined) {
    options.forceRefresh = body.forceRefresh;
  }

  if (body.includeRealLegal !== undefined) {
    options.includeRealLegal = body.includeRealLegal;
  }

  const result = await signalScanService.runScan(options);

  response.json(result);
};
