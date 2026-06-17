import type { Request, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { symbolRepository } from '../repositories/symbol.repository';
import { analysisCacheRepository } from '../repositories/analysisCache.repository';
import {
  analyzeSymbolMetrics,
  getStochRsiConfig
} from '../services/analysis.service';
import { symbolDataService } from '../services/symbolData.service';
import { createHash } from '../utils/hash';
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

const buildSource = (refreshed: boolean): 'database' | 'brsapi' => {
  return refreshed ? 'brsapi' : 'database';
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
  let history = await symbolRepository.getSymbolHistory(symbol);
  const shouldRefresh = params.forceRefresh || history.length === 0;

  if (shouldRefresh) {
    await symbolDataService.refreshSymbolHistory(
      symbol,
      params.includeRealLegal
    );
    history = await symbolRepository.getSymbolHistory(symbol);
  }

  const latestDataDate = history.at(-1)?.date;
  if (!latestDataDate) {
    throw new AppError('داده‌ای برای نماد یافت نشد.', 404, {
      englishMessage: 'No symbol data found'
    });
  }

  const paramsHash = createHash({
    weeklyWindow: params.weeklyWindow,
    monthlyWindow: params.monthlyWindow,
    quarterlyWindow: params.quarterlyWindow,
    includeRealLegal: params.includeRealLegal,
    stochRsi: getStochRsiConfig()
  });

  const activeCache = await analysisCacheRepository.getActiveCache(
    symbol,
    paramsHash,
    latestDataDate
  );

  if (activeCache && activeCache.expiresAt > new Date()) {
    const cachedResult = activeCache.result as StockAnalysisResult;
    const finalResult = {
      ...cachedResult,
      cacheHit: true
    };
    await persistRequestLog(
      request,
      symbol,
      params,
      true,
      cachedResult.source,
      cachedResult.status
    );
    response.json(finalResult);
    return;
  }

  const result = analyzeSymbolMetrics(
    symbol,
    history,
    params,
    buildSource(shouldRefresh),
    false
  );

  const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000);
  await analysisCacheRepository.saveCache(
    symbol,
    paramsHash,
    latestDataDate,
    result,
    expiresAt
  );
  await persistRequestLog(
    request,
    symbol,
    params,
    false,
    result.source,
    result.status
  );

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
