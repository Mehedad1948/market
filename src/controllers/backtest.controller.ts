import type { Request, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import {
  backtestService,
  type BacktestReportOptions,
  type CompareBacktestsOptions,
  type RunBacktestOptions
} from '../services/backtest.service';

const indicatorComponentSchema = z.enum([
  'liquidity',
  'stochRsi',
  'priceTrend',
  'adx',
  'atr'
]);

const backtestComparisonVariantSchema = z.enum([
  'full_composite',
  'stochRsi_only',
  'priceTrend_only',
  'liquidity_only',
  'composite_without_atr',
  'composite_without_adx',
  'composite_without_stochRsi',
  'composite_without_priceTrend'
]);

const commaListSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(','));
  }

  if (typeof value === 'string') {
    return value.split(',');
  }

  return value;
}, z.array(z.string()).optional());

const cleanSymbolList = (symbols?: string[]) =>
  symbols
    ?.map((symbol) => symbol.trim())
    .filter((symbol) => symbol.length > 0);

const backtestRunBodySchema = z
  .object({
    symbols: z.array(z.string()).optional(),
    dateFrom: z.string().min(1).optional(),
    dateTo: z.string().min(1).optional(),
    maxSymbols: z.number().int().positive().max(500).optional(),
    maxSnapshotsPerSymbol: z.number().int().positive().max(5000).optional(),
    weeklyWindow: z.number().int().positive().default(env.DEFAULT_WEEKLY_WINDOW),
    monthlyWindow: z.number().int().positive().default(env.DEFAULT_MONTHLY_WINDOW),
    quarterlyWindow: z
      .number()
      .int()
      .positive()
      .default(env.DEFAULT_QUARTERLY_WINDOW),
    includeRealLegal: z.boolean().optional().default(false),
    indicatorMode: z
      .enum(['composite', 'liquidity_only', 'stochRsi_only', 'priceTrend_only'])
      .optional()
      .default('composite'),
    disabledIndicators: z.array(indicatorComponentSchema).optional().default([])
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

const backtestReportQuerySchema = z.object({
  runId: z.string().min(1).optional(),
  scoringVersion: z.coerce.number().int().positive().optional(),
  paramsHash: z.string().min(1).optional(),
  symbols: commaListSchema,
  dateFrom: z.string().min(1).optional(),
  dateTo: z.string().min(1).optional(),
  sectorName: z.string().min(1).optional(),
  compositeAction: z.string().min(1).optional(),
  compositeBias: z.string().min(1).optional(),
  entryTiming: z.string().min(1).optional(),
  liquidityBucket: z.string().min(1).optional(),
  volatilityRegime: z.string().min(1).optional(),
  timeframe: z.enum(['midTerm', 'longTerm']).optional(),
  forNewPosition: z.string().min(1).optional(),
  forExistingPosition: z.string().min(1).optional(),
  minScore: z.coerce.number().int().min(-100).max(100).optional(),
  maxScore: z.coerce.number().int().min(-100).max(100).optional(),
  groupBy: z
    .enum([
      'compositeAction',
      'scoreBucket',
      'sector',
      'liquidityBucket',
      'volatilityRegime',
      'bias',
      'entryTiming',
      'symbol'
    ])
    .optional(),
  limit: z.coerce.number().int().positive().max(100000).default(50000)
});

const backtestCompareBodySchema = z
  .object({
    symbol: z.string().trim().min(1),
    dateFrom: z.string().min(1).optional(),
    dateTo: z.string().min(1).optional(),
    maxSnapshotsPerSymbol: z.number().int().positive().max(5000).optional(),
    weeklyWindow: z.number().int().positive().default(env.DEFAULT_WEEKLY_WINDOW),
    monthlyWindow: z.number().int().positive().default(env.DEFAULT_MONTHLY_WINDOW),
    quarterlyWindow: z
      .number()
      .int()
      .positive()
      .default(env.DEFAULT_QUARTERLY_WINDOW),
    includeRealLegal: z.boolean().optional().default(false),
    reportLimit: z.number().int().positive().max(100000).optional(),
    variants: z.array(backtestComparisonVariantSchema).optional()
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

export const runBacktest = async (request: Request, response: Response) => {
  const body = backtestRunBodySchema.parse(request.body);
  const { symbols: rawSymbols } = body;
  const symbols = cleanSymbolList(rawSymbols);
  const options: RunBacktestOptions = {
    weeklyWindow: body.weeklyWindow,
    monthlyWindow: body.monthlyWindow,
    quarterlyWindow: body.quarterlyWindow,
    includeRealLegal: body.includeRealLegal,
    indicatorMode: body.indicatorMode,
    disabledIndicators: body.disabledIndicators
  };

  if (symbols && symbols.length > 0) {
    options.symbols = symbols;
  }

  if (body.dateFrom !== undefined) options.dateFrom = body.dateFrom;
  if (body.dateTo !== undefined) options.dateTo = body.dateTo;
  if (body.maxSymbols !== undefined) options.maxSymbols = body.maxSymbols;
  if (body.maxSnapshotsPerSymbol !== undefined) {
    options.maxSnapshotsPerSymbol = body.maxSnapshotsPerSymbol;
  }

  const result = await backtestService.runBacktest(options);

  response.status(result.status === 'OK' ? 201 : 500).json(result);
};

export const getBacktestReport = async (
  request: Request,
  response: Response
) => {
  const query = backtestReportQuerySchema.parse(request.query);
  const { symbols: rawSymbols } = query;
  const symbols = cleanSymbolList(rawSymbols);
  const options: BacktestReportOptions = {
    limit: query.limit
  };

  if (symbols && symbols.length > 0) {
    options.symbols = symbols;
  }

  if (query.runId !== undefined) options.runId = query.runId;
  if (query.scoringVersion !== undefined) {
    options.scoringVersion = query.scoringVersion;
  }
  if (query.paramsHash !== undefined) options.paramsHash = query.paramsHash;
  if (query.dateFrom !== undefined) options.dateFrom = query.dateFrom;
  if (query.dateTo !== undefined) options.dateTo = query.dateTo;
  if (query.sectorName !== undefined) options.sectorName = query.sectorName;
  if (query.compositeAction !== undefined) {
    options.compositeAction = query.compositeAction;
  }
  if (query.compositeBias !== undefined) {
    options.compositeBias = query.compositeBias;
  }
  if (query.entryTiming !== undefined) options.entryTiming = query.entryTiming;
  if (query.liquidityBucket !== undefined) {
    options.liquidityBucket = query.liquidityBucket;
  }
  if (query.volatilityRegime !== undefined) {
    options.volatilityRegime = query.volatilityRegime;
  }
  if (query.timeframe !== undefined) options.timeframe = query.timeframe;
  if (query.forNewPosition !== undefined) {
    options.forNewPosition = query.forNewPosition;
  }
  if (query.forExistingPosition !== undefined) {
    options.forExistingPosition = query.forExistingPosition;
  }
  if (query.minScore !== undefined) options.minScore = query.minScore;
  if (query.maxScore !== undefined) options.maxScore = query.maxScore;
  if (query.groupBy !== undefined) options.groupBy = query.groupBy;

  const result = await backtestService.getReport(options);

  if (!result) {
    throw new AppError('Backtest run not found.', 404, {
      englishMessage: 'Backtest run not found'
    });
  }

  response.json(result);
};

export const compareBacktests = async (
  request: Request,
  response: Response
) => {
  const body = backtestCompareBodySchema.parse(request.body);
  const options: CompareBacktestsOptions = {
    symbol: body.symbol,
    weeklyWindow: body.weeklyWindow,
    monthlyWindow: body.monthlyWindow,
    quarterlyWindow: body.quarterlyWindow,
    includeRealLegal: body.includeRealLegal
  };

  if (body.dateFrom !== undefined) options.dateFrom = body.dateFrom;
  if (body.dateTo !== undefined) options.dateTo = body.dateTo;
  if (body.maxSnapshotsPerSymbol !== undefined) {
    options.maxSnapshotsPerSymbol = body.maxSnapshotsPerSymbol;
  }
  if (body.reportLimit !== undefined) options.reportLimit = body.reportLimit;
  if (body.variants !== undefined) options.variants = body.variants;

  const result = await backtestService.compareBacktests(options);

  response.status(201).json(result);
};
