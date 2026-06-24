import type { BacktestRun, BacktestSignalSnapshot, Prisma, SymbolDailyMetric } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { backtestRepository, type BacktestReportSnapshotFilters } from '../repositories/backtest.repository';
import type {
  AnalysisScoringOverrides,
  AnalysisIndicatorComponent,
  IndicatorMode,
  StockAnalysisResult,
  SymbolAnalysisParams
} from '../types';
import { compareDateStrings } from '../utils/dateSort';
import {
  InsufficientDataError,
  analyzeSymbolMetrics,
  buildAnalysisParamsHash
} from './analysis.service';

export const BACKTEST_HORIZONS = [1, 5, 20, 60] as const;

type BacktestHorizon = (typeof BACKTEST_HORIZONS)[number];
type HorizonKey = '1d' | '5d' | '20d' | '60d';
type TimeframeKey = 'midTerm' | 'longTerm';

const horizonKeyMap: Record<BacktestHorizon, HorizonKey> = {
  1: '1d',
  5: '5d',
  20: '20d',
  60: '60d'
};

const toNumber = (
  value: Prisma.Decimal | number | string | null | undefined
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value: number, decimals = 6): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return round(sorted[middle]!);
  }

  return round((sorted[middle - 1]! + sorted[middle]!) / 2);
};

const ratio = (count: number, total: number): number | null => {
  if (total === 0) {
    return null;
  }

  return round(count / total);
};

const getClosePrice = (row: SymbolDailyMetric): number | null => {
  return toNumber(row.closePrice);
};

const getPositivePrice = (
  value: Prisma.Decimal | number | string | null | undefined
): number | null => {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const getDrawdownPrice = (row: SymbolDailyMetric): number | null => {
  return getPositivePrice(row.priceMin) ?? getPositivePrice(row.closePrice);
};

type DrawdownObservation = {
  horizon: HorizonKey;
  lowestPrice: number | null;
  lowestPriceDate: string | null;
  source: 'priceMin' | 'closePrice' | 'unknown';
  maxDrawdown: number | null;
  flaggedAsFullLoss: boolean;
};

type DrawdownDiagnosticsEntry = {
  symbol: string;
  asOfDate: string;
  horizon: HorizonKey;
  entryClose: number;
  lowestPrice: number | null;
  lowestPriceDate: string | null;
  source: 'priceMin' | 'closePrice' | 'unknown';
  maxDrawdown: number | null;
};

type ForwardOutcomeSet = {
  forwardReturn1d: number | null;
  forwardReturn5d: number | null;
  forwardReturn20d: number | null;
  forwardReturn60d: number | null;
  maxDrawdown1d: number | null;
  maxDrawdown5d: number | null;
  maxDrawdown20d: number | null;
  maxDrawdown60d: number | null;
};

type ForwardOutcomeResult = {
  metrics: ForwardOutcomeSet;
  drawdownObservations: DrawdownObservation[];
};

const calculateForwardReturn = (
  entryClose: number,
  futureRow: SymbolDailyMetric
): number | null => {
  const futureClose = getClosePrice(futureRow);
  if (futureClose === null || entryClose <= 0) {
    return null;
  }

  return round((futureClose - entryClose) / entryClose);
};

const calculateMaxDrawdown = (
  entryClose: number,
  futureRows: SymbolDailyMetric[]
): number | null => {
  if (entryClose <= 0 || futureRows.length === 0) {
    return null;
  }

  const drawdownPrices = futureRows
    .map((row) => getDrawdownPrice(row))
    .filter((value): value is number => value !== null);

  if (drawdownPrices.length === 0) {
    return null;
  }

  const lowestPrice = Math.min(...drawdownPrices);
  return round((lowestPrice - entryClose) / entryClose);
};

const inspectDrawdown = (
  entryClose: number,
  futureRows: SymbolDailyMetric[],
  horizon: HorizonKey
): DrawdownObservation => {
  if (entryClose <= 0 || futureRows.length === 0) {
    return {
      horizon,
      lowestPrice: null,
      lowestPriceDate: null,
      source: 'unknown',
      maxDrawdown: null,
      flaggedAsFullLoss: false
    };
  }

  let lowestPrice: number | null = null;
  let lowestPriceDate: string | null = null;
  let source: 'priceMin' | 'closePrice' | 'unknown' = 'unknown';

  for (const row of futureRows) {
    const priceMin = getPositivePrice(row.priceMin);
    const closePrice = getPositivePrice(row.closePrice);
    const candidatePrice = priceMin ?? closePrice;
    const candidateSource =
      priceMin !== null ? 'priceMin' : closePrice !== null ? 'closePrice' : 'unknown';

    if (candidatePrice === null) {
      continue;
    }

    if (lowestPrice === null || candidatePrice < lowestPrice) {
      lowestPrice = candidatePrice;
      lowestPriceDate = row.date;
      source = candidateSource;
    }
  }

  const maxDrawdown =
    lowestPrice === null ? null : round((lowestPrice - entryClose) / entryClose);

  return {
    horizon,
    lowestPrice,
    lowestPriceDate,
    source,
    maxDrawdown,
    flaggedAsFullLoss: maxDrawdown !== null && maxDrawdown <= -0.95
  };
};

const buildForwardOutcomes = (
  rows: SymbolDailyMetric[],
  index: number,
  entryClose: number
) => {
  const outcome: Record<string, number | null> = {};
  const drawdownObservations: DrawdownObservation[] = [];

  for (const horizon of BACKTEST_HORIZONS) {
    const key = horizonKeyMap[horizon];
    const futureRow = rows[index + horizon];
    const futureRows = rows.slice(index + 1, index + horizon + 1);

    outcome[`forwardReturn${key}`] = futureRow
      ? calculateForwardReturn(entryClose, futureRow)
      : null;
    const drawdownInspection = inspectDrawdown(entryClose, futureRows, key);
    outcome[`maxDrawdown${key}`] = drawdownInspection.maxDrawdown;
    drawdownObservations.push(drawdownInspection);
  }

  return {
    metrics: outcome as ForwardOutcomeSet,
    drawdownObservations
  };
};

const classifyLiquidityBucket = (relativeTradeValue20: number | null): string => {
  if (relativeTradeValue20 === null) {
    return 'UNKNOWN';
  }

  if (relativeTradeValue20 >= env.LIQUIDITY_EXPANSION_THRESHOLD) {
    return 'EXPANSION';
  }

  if (relativeTradeValue20 <= env.LIQUIDITY_CONTRACTION_THRESHOLD) {
    return 'CONTRACTION';
  }

  return 'NORMAL';
};

const classifyScoreBucket = (score: number): string => {
  if (score >= 70) {
    return '+70_TO_+100';
  }

  if (score >= 35) {
    return '+35_TO_+69';
  }

  if (score >= 10) {
    return '+10_TO_+34';
  }

  if (score >= -9) {
    return '-9_TO_+9';
  }

  if (score >= -34) {
    return '-10_TO_-34';
  }

  if (score >= -69) {
    return '-35_TO_-69';
  }

  return '-70_TO_-100';
};

const extractTimeframeSnapshot = (
  result: StockAnalysisResult,
  timeframe: TimeframeKey
) => {
  const value = result.signals.composite.timeframes[timeframe];

  return {
    action: value.action.value,
    score: value.score,
    quality: value.quality.value,
    forNewPosition: value.positionAdvice.forNewPosition.value,
    forExistingPosition: value.positionAdvice.forExistingPosition.value
  };
};

const buildSnapshotRow = ({
  runId,
  result,
  sectorId,
  sectorName,
  outcomes
}: {
  runId: string;
  result: StockAnalysisResult;
  sectorId: string | null;
  sectorName: string | null;
  outcomes: ForwardOutcomeSet;
}): Prisma.BacktestSignalSnapshotCreateManyInput => {
  const midTerm = extractTimeframeSnapshot(result, 'midTerm');
  const longTerm = extractTimeframeSnapshot(result, 'longTerm');

  return {
    runId,
    symbol: result.symbol,
    asOfDate: result.latestDataDate,
    sectorId,
    sectorName,
    latestClosePrice: result.metrics.latestClosePrice,
    compositeAction: result.signals.composite.action.value,
    compositeScore: result.signals.composite.score,
    compositeBias: result.signals.composite.bias.value,
    compositeEntryTiming: result.signals.composite.entryTiming.value,
    shortAction: 'WAIT',
    shortScore: 0,
    shortQuality: 'NEUTRAL',
    shortForNewPosition: 'WAIT',
    shortForExistingPosition: 'MONITOR',
    midAction: midTerm.action,
    midScore: midTerm.score,
    midQuality: midTerm.quality,
    midForNewPosition: midTerm.forNewPosition,
    midForExistingPosition: midTerm.forExistingPosition,
    longAction: longTerm.action,
    longScore: longTerm.score,
    longQuality: longTerm.quality,
    longForNewPosition: longTerm.forNewPosition,
    longForExistingPosition: longTerm.forExistingPosition,
    atrVolatilityRegime: result.signals.atr.volatilityRegime.value,
    relativeTradeValue20: result.metrics.relativeTradeValue20,
    liquidityBucket: classifyLiquidityBucket(result.metrics.relativeTradeValue20),
    ...outcomes
  };
};

export type RunBacktestOptions = {
  symbols?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxSymbols?: number;
  maxSnapshotsPerSymbol?: number;
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  includeRealLegal?: boolean;
  indicatorMode?: IndicatorMode;
  disabledIndicators?: AnalysisIndicatorComponent[];
  scoringOverrides?: AnalysisScoringOverrides;
};

type BacktestRunError = {
  symbol: string;
  asOfDate?: string;
  reason: string;
};

const buildAnalysisParams = (options: RunBacktestOptions): SymbolAnalysisParams => {
  return {
    weeklyWindow: options.weeklyWindow ?? env.DEFAULT_WEEKLY_WINDOW,
    monthlyWindow: options.monthlyWindow ?? env.DEFAULT_MONTHLY_WINDOW,
    quarterlyWindow: options.quarterlyWindow ?? env.DEFAULT_QUARTERLY_WINDOW,
    forceRefresh: false,
    includeRealLegal: options.includeRealLegal ?? false,
    indicatorMode: options.indicatorMode ?? 'composite',
    disabledIndicators: options.disabledIndicators ?? [],
    ...(options.scoringOverrides ? { scoringOverrides: options.scoringOverrides } : {})
  };
};

const dateIsInRange = (
  date: string,
  dateFrom?: string,
  dateTo?: string
): boolean => {
  if (dateFrom && compareDateStrings(date, dateFrom) < 0) {
    return false;
  }

  if (dateTo && compareDateStrings(date, dateTo) > 0) {
    return false;
  }

  return true;
};

const buildRunSummary = (run: BacktestRun) => ({
  id: run.id,
  status: run.status,
  paramsHash: run.paramsHash,
  params: run.params,
  scoringVersion: run.scoringVersion,
  horizons: run.horizons,
  symbols: run.symbols,
  symbolCount: run.symbolCount,
  snapshotCount: run.snapshotCount,
  skippedCount: run.skippedCount,
  errorCount: run.errorCount,
  errors: run.errors,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt
});

export type BacktestSnapshotLike = Pick<
  BacktestSignalSnapshot,
  | 'symbol'
  | 'asOfDate'
  | 'sectorName'
  | 'compositeAction'
  | 'compositeScore'
  | 'compositeBias'
  | 'compositeEntryTiming'
  | 'shortAction'
  | 'shortScore'
  | 'shortQuality'
  | 'shortForNewPosition'
  | 'shortForExistingPosition'
  | 'midAction'
  | 'midScore'
  | 'midQuality'
  | 'midForNewPosition'
  | 'midForExistingPosition'
  | 'longAction'
  | 'longScore'
  | 'longQuality'
  | 'longForNewPosition'
  | 'longForExistingPosition'
  | 'atrVolatilityRegime'
  | 'liquidityBucket'
  | 'forwardReturn1d'
  | 'forwardReturn5d'
  | 'forwardReturn20d'
  | 'forwardReturn60d'
  | 'maxDrawdown1d'
  | 'maxDrawdown5d'
  | 'maxDrawdown20d'
  | 'maxDrawdown60d'
>;

type HorizonMetrics = {
  sampleCount: number;
  avgReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  negativeReturnRate: number | null;
  bestReturn: number | null;
  worstReturn: number | null;
  avgMaxDrawdown: number | null;
  worstDrawdown: number | null;
  profitFactorLikeRatio: number | null;
};

type GroupReport = {
  key: string;
  sampleCount: number;
  horizons: Record<HorizonKey, HorizonMetrics>;
};

type CompactHorizonSummary = {
  sampleCount: number;
  avgReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  profitFactorLikeRatio: number | null;
  avgMaxDrawdown: number | null;
  worstDrawdown: number | null;
};

const getReturnValue = (
  row: BacktestSnapshotLike,
  horizon: HorizonKey
): number | null => {
  return toNumber(row[`forwardReturn${horizon}` as keyof BacktestSnapshotLike]);
};

const getDrawdownValue = (
  row: BacktestSnapshotLike,
  horizon: HorizonKey
): number | null => {
  return toNumber(row[`maxDrawdown${horizon}` as keyof BacktestSnapshotLike]);
};

const calculateHorizonMetrics = (
  rows: BacktestSnapshotLike[],
  horizon: HorizonKey
): HorizonMetrics => {
  const returns = rows
    .map((row) => getReturnValue(row, horizon))
    .filter((value): value is number => value !== null);
  const drawdowns = rows
    .map((row) => getDrawdownValue(row, horizon))
    .filter((value): value is number => value !== null);
  const positiveReturns = returns.filter((value) => value > 0);
  const negativeReturns = returns.filter((value) => value < 0);
  const positiveSum = positiveReturns.reduce((sum, value) => sum + value, 0);
  const negativeSum = negativeReturns.reduce((sum, value) => sum + value, 0);

  return {
    sampleCount: returns.length,
    avgReturn: average(returns),
    medianReturn: median(returns),
    winRate: ratio(positiveReturns.length, returns.length),
    negativeReturnRate: ratio(negativeReturns.length, returns.length),
    bestReturn: returns.length > 0 ? round(Math.max(...returns)) : null,
    worstReturn: returns.length > 0 ? round(Math.min(...returns)) : null,
    avgMaxDrawdown: average(drawdowns),
    worstDrawdown: drawdowns.length > 0 ? round(Math.min(...drawdowns)) : null,
    profitFactorLikeRatio:
      negativeSum < 0 ? round(positiveSum / Math.abs(negativeSum)) : null
  };
};

const buildGroupReport = (
  key: string,
  rows: BacktestSnapshotLike[]
): GroupReport => {
  return {
    key,
    sampleCount: rows.length,
    horizons: {
      '1d': calculateHorizonMetrics(rows, '1d'),
      '5d': calculateHorizonMetrics(rows, '5d'),
      '20d': calculateHorizonMetrics(rows, '20d'),
      '60d': calculateHorizonMetrics(rows, '60d')
    }
  };
};

const aggregateBy = (
  rows: BacktestSnapshotLike[],
  getKey: (row: BacktestSnapshotLike) => string | null | undefined
): GroupReport[] => {
  const groups = new Map<string, BacktestSnapshotLike[]>();

  for (const row of rows) {
    const key = getKey(row) ?? 'UNKNOWN';
    const groupRows = groups.get(key) ?? [];
    groupRows.push(row);
    groups.set(key, groupRows);
  }

  return [...groups.entries()]
    .map(([key, groupRows]) => buildGroupReport(key, groupRows))
    .sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) {
        return right.sampleCount - left.sampleCount;
      }

      return left.key.localeCompare(right.key);
    });
};

const getTimeframeValue = (
  row: BacktestSnapshotLike,
  timeframe: TimeframeKey,
  field: 'action' | 'score' | 'quality' | 'forNewPosition' | 'forExistingPosition'
): string | number => {
  const prefix = timeframe === 'midTerm' ? 'mid' : 'long';

  if (field === 'action') {
    return row[`${prefix}Action` as keyof BacktestSnapshotLike] as string;
  }

  if (field === 'score') {
    return row[`${prefix}Score` as keyof BacktestSnapshotLike] as number;
  }

  if (field === 'quality') {
    return row[`${prefix}Quality` as keyof BacktestSnapshotLike] as string;
  }

  if (field === 'forNewPosition') {
    return row[`${prefix}ForNewPosition` as keyof BacktestSnapshotLike] as string;
  }

  return row[`${prefix}ForExistingPosition` as keyof BacktestSnapshotLike] as string;
};

const buildTimeframeReport = (
  rows: BacktestSnapshotLike[],
  timeframe: TimeframeKey
) => ({
  overall: buildGroupReport('ALL', rows),
  byAction: aggregateBy(rows, (row) =>
    String(getTimeframeValue(row, timeframe, 'action'))
  ),
  byQuality: aggregateBy(rows, (row) =>
    String(getTimeframeValue(row, timeframe, 'quality'))
  ),
  byScoreBucket: aggregateBy(rows, (row) =>
    classifyScoreBucket(Number(getTimeframeValue(row, timeframe, 'score')))
  ),
  byForNewPosition: aggregateBy(rows, (row) =>
    String(getTimeframeValue(row, timeframe, 'forNewPosition'))
  ),
  byForExistingPosition: aggregateBy(rows, (row) =>
    String(getTimeframeValue(row, timeframe, 'forExistingPosition'))
  )
});

const buildCustomGroups = (
  rows: BacktestSnapshotLike[],
  groupBy?: string
): GroupReport[] | null => {
  if (!groupBy) {
    return null;
  }

  const groupers: Record<string, (row: BacktestSnapshotLike) => string> = {
    compositeAction: (row) => row.compositeAction,
    scoreBucket: (row) => classifyScoreBucket(row.compositeScore),
    sector: (row) => row.sectorName ?? 'UNKNOWN',
    liquidityBucket: (row) => row.liquidityBucket,
    volatilityRegime: (row) => row.atrVolatilityRegime,
    bias: (row) => row.compositeBias,
    entryTiming: (row) => row.compositeEntryTiming,
    symbol: (row) => row.symbol
  };

  const grouper = groupers[groupBy];
  return grouper ? aggregateBy(rows, grouper) : null;
};

const compactHorizonMetrics = (
  metrics?: HorizonMetrics | null
): CompactHorizonSummary | null => {
  if (!metrics) {
    return null;
  }

  return {
    sampleCount: metrics.sampleCount,
    avgReturn: metrics.avgReturn,
    medianReturn: metrics.medianReturn,
    winRate: metrics.winRate,
    profitFactorLikeRatio: metrics.profitFactorLikeRatio,
    avgMaxDrawdown: metrics.avgMaxDrawdown,
    worstDrawdown: metrics.worstDrawdown
  };
};

const sortGroupsByHorizonMetric = (
  groups: GroupReport[] | undefined,
  horizon: HorizonKey,
  metric: keyof HorizonMetrics,
  direction: 'asc' | 'desc'
): GroupReport[] => {
  if (!groups) {
    return [];
  }

  return [...groups]
    .filter((group) => group.horizons[horizon]?.[metric] !== null)
    .sort((left, right) => {
      const leftValue = left.horizons[horizon]?.[metric];
      const rightValue = right.horizons[horizon]?.[metric];

      if (leftValue === null || leftValue === undefined) return 1;
      if (rightValue === null || rightValue === undefined) return -1;

      return direction === 'desc'
        ? Number(rightValue) - Number(leftValue)
        : Number(leftValue) - Number(rightValue);
    });
};

const toCompactGroupSnippet = (
  group: GroupReport,
  horizon: HorizonKey
) => ({
  key: group.key,
  sampleCount: group.sampleCount,
  horizon,
  avgReturn: group.horizons[horizon]?.avgReturn ?? null,
  winRate: group.horizons[horizon]?.winRate ?? null,
  profitFactorLikeRatio: group.horizons[horizon]?.profitFactorLikeRatio ?? null
});

const sanitizeFilenamePart = (value: string): string =>
  value.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ||
  'report';

export const buildBacktestReport = (
  rows: BacktestSnapshotLike[],
  groupBy?: string
) => {
  const drawdownDiagnostics = BACKTEST_HORIZONS.map((horizon) => {
    const key = horizonKeyMap[horizon];
    return {
      horizon: key,
      fullLossCount: rows.filter((row) => getDrawdownValue(row, key) === -1).length,
      nearFullLossCount: rows.filter((row) => {
        const value = getDrawdownValue(row, key);
        return value !== null && value <= -0.95;
      }).length
    };
  });

  return {
    sampleCount: rows.length,
    global: {
      overall: buildGroupReport('ALL', rows),
      byCompositeAction: aggregateBy(rows, (row) => row.compositeAction),
      byScoreBucket: aggregateBy(rows, (row) =>
        classifyScoreBucket(row.compositeScore)
      ),
      bySector: aggregateBy(rows, (row) => row.sectorName ?? 'UNKNOWN'),
      byLiquidityBucket: aggregateBy(rows, (row) => row.liquidityBucket),
      byVolatilityRegime: aggregateBy(rows, (row) => row.atrVolatilityRegime),
      byBias: aggregateBy(rows, (row) => row.compositeBias),
      byEntryTiming: aggregateBy(rows, (row) => row.compositeEntryTiming)
    },
    timeframes: {
      midTerm: buildTimeframeReport(rows, 'midTerm'),
      longTerm: buildTimeframeReport(rows, 'longTerm')
    },
    customGroups: buildCustomGroups(rows, groupBy),
    diagnostics: {
      drawdown: drawdownDiagnostics
    }
  };
};

export type BacktestReportOptions = Omit<
  BacktestReportSnapshotFilters,
  'runId'
> & {
  runId?: string;
  scoringVersion?: number;
  paramsHash?: string;
  limit?: number;
  groupBy?: string;
};

export type BacktestComparisonVariantKey =
  | 'full_composite'
  | 'stochRsi_only'
  | 'priceTrend_only'
  | 'mfi_only'
  | 'liquidity_only'
  | 'composite_without_atr'
  | 'composite_without_adx'
  | 'composite_without_stochRsi'
  | 'composite_without_priceTrend'
  | 'composite_without_mfi';

export type CompareBacktestsOptions = {
  symbol: string;
  dateFrom?: string;
  dateTo?: string;
  maxSnapshotsPerSymbol?: number;
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  includeRealLegal?: boolean;
  scoringOverrides?: AnalysisScoringOverrides;
  variants?: BacktestComparisonVariantKey[];
  reportLimit?: number;
};

const backtestComparisonVariants: Record<
  BacktestComparisonVariantKey,
  {
    indicatorMode?: IndicatorMode;
    disabledIndicators?: AnalysisIndicatorComponent[];
  }
> = {
  full_composite: {
    indicatorMode: 'composite',
    disabledIndicators: []
  },
  stochRsi_only: {
    indicatorMode: 'stochRsi_only',
    disabledIndicators: []
  },
  priceTrend_only: {
    indicatorMode: 'priceTrend_only',
    disabledIndicators: []
  },
  mfi_only: {
    indicatorMode: 'mfi_only',
    disabledIndicators: []
  },
  liquidity_only: {
    indicatorMode: 'liquidity_only',
    disabledIndicators: []
  },
  composite_without_atr: {
    indicatorMode: 'composite',
    disabledIndicators: ['atr']
  },
  composite_without_adx: {
    indicatorMode: 'composite',
    disabledIndicators: ['adx']
  },
  composite_without_stochRsi: {
    indicatorMode: 'composite',
    disabledIndicators: ['stochRsi']
  },
  composite_without_priceTrend: {
    indicatorMode: 'composite',
    disabledIndicators: ['priceTrend']
  },
  composite_without_mfi: {
    indicatorMode: 'composite',
    disabledIndicators: ['mfi']
  }
};

const buildCompactComparisonExport = (payload: {
  symbol: string;
  comparisons: Array<{
    key: BacktestComparisonVariantKey;
    config: {
      indicatorMode?: IndicatorMode;
      disabledIndicators?: AnalysisIndicatorComponent[];
    };
    run: ReturnType<typeof buildRunSummary>;
    report: ReturnType<typeof buildBacktestReport> | null;
    drawdownDiagnostics?: DrawdownDiagnosticsEntry[];
  }>;
}) => {
  const fullComposite =
    payload.comparisons.find((variant) => variant.key === 'full_composite') ?? null;
  const baseline20d =
    fullComposite?.report?.global.overall.horizons['20d']?.avgReturn ?? null;
  const baseline60d =
    fullComposite?.report?.global.overall.horizons['60d']?.avgReturn ?? null;

  const variants = payload.comparisons.map((variant) => {
    const report = variant.report;
    const overall20d = report?.global.overall.horizons['20d'] ?? null;
    const overall60d = report?.global.overall.horizons['60d'] ?? null;
    const strongActions = sortGroupsByHorizonMetric(
      report?.global.byCompositeAction,
      '60d',
      'avgReturn',
      'desc'
    )
      .filter((group) => group.sampleCount >= 20)
      .slice(0, 2)
      .map((group) => toCompactGroupSnippet(group, '60d'));
    const weakActions = sortGroupsByHorizonMetric(
      report?.global.byCompositeAction,
      '20d',
      'avgReturn',
      'asc'
    )
      .filter((group) => group.sampleCount >= 20)
      .slice(0, 2)
      .map((group) => toCompactGroupSnippet(group, '20d'));
    const strongScoreBuckets = sortGroupsByHorizonMetric(
      report?.global.byScoreBucket,
      '60d',
      'avgReturn',
      'desc'
    )
      .filter((group) => group.sampleCount >= 20)
      .slice(0, 2)
      .map((group) => toCompactGroupSnippet(group, '60d'));

    return {
      key: variant.key,
      indicatorMode: variant.config.indicatorMode ?? 'composite',
      disabledIndicators: variant.config.disabledIndicators ?? [],
      sampleCount: report?.sampleCount ?? 0,
      snapshotCount: variant.run.snapshotCount,
      errors: variant.run.errorCount,
      overall: {
        '20d': compactHorizonMetrics(overall20d),
        '60d': compactHorizonMetrics(overall60d)
      },
      drawdown: report?.diagnostics.drawdown ?? [],
      drawdownExamples:
        variant.drawdownDiagnostics?.slice(0, 8).map((entry) => ({
          horizon: entry.horizon,
          asOfDate: entry.asOfDate,
          entryClose: entry.entryClose,
          lowestPrice: entry.lowestPrice,
          lowestPriceDate: entry.lowestPriceDate,
          source: entry.source,
          maxDrawdown: entry.maxDrawdown
        })) ?? [],
      deltaVsFullComposite: {
        avgReturn20d:
          overall20d?.avgReturn !== null &&
          overall20d?.avgReturn !== undefined &&
          baseline20d !== null
            ? round(overall20d.avgReturn - baseline20d)
            : null,
        avgReturn60d:
          overall60d?.avgReturn !== null &&
          overall60d?.avgReturn !== undefined &&
          baseline60d !== null
            ? round(overall60d.avgReturn - baseline60d)
            : null
      },
      warnings: [
        ...(report?.sampleCount && report.sampleCount < 30 ? ['LOW_SAMPLE'] : []),
        ...(overall60d?.avgMaxDrawdown !== null &&
        overall60d?.avgMaxDrawdown !== undefined &&
        overall60d.avgMaxDrawdown <= -0.5
          ? ['EXTREME_DRAWDOWN_60D']
          : []),
        ...(overall60d?.worstDrawdown === -1 ? ['WORST_DRAWDOWN_FULL_LOSS'] : [])
      ],
      subgroupHints: {
        bestCompositeActions60d: strongActions,
        worstCompositeActions20d: weakActions,
        bestScoreBuckets60d: strongScoreBuckets
      }
    };
  });

  const best60d = [...variants]
    .filter((variant) => variant.overall['60d']?.avgReturn !== null)
    .sort(
      (left, right) =>
        Number(right.overall['60d']?.avgReturn ?? -Infinity) -
        Number(left.overall['60d']?.avgReturn ?? -Infinity)
    )[0] ?? null;
  const best20dProfitFactor = [...variants]
    .filter((variant) => variant.overall['20d']?.profitFactorLikeRatio !== null)
    .sort(
      (left, right) =>
        Number(right.overall['20d']?.profitFactorLikeRatio ?? -Infinity) -
        Number(left.overall['20d']?.profitFactorLikeRatio ?? -Infinity)
    )[0] ?? null;

  return {
    purpose: 'compact-backtest-comparison-for-llm-analysis',
    generatedAt: new Date().toISOString(),
    symbol: payload.symbol,
    variantCount: variants.length,
    headline: {
      bestAvgReturn60d: best60d
        ? {
            key: best60d.key,
            avgReturn60d: best60d.overall['60d']?.avgReturn ?? null
          }
        : null,
      bestProfitFactor20d: best20dProfitFactor
        ? {
            key: best20dProfitFactor.key,
            profitFactor20d:
              best20dProfitFactor.overall['20d']?.profitFactorLikeRatio ?? null
          }
        : null
    },
    variants
  };
};

const writeCompactComparisonExport = async (payload: {
  symbol: string;
  comparisons: Array<{
    key: BacktestComparisonVariantKey;
    config: {
      indicatorMode?: IndicatorMode;
      disabledIndicators?: AnalysisIndicatorComponent[];
    };
    run: ReturnType<typeof buildRunSummary>;
    report: ReturnType<typeof buildBacktestReport> | null;
    drawdownDiagnostics?: DrawdownDiagnosticsEntry[];
  }>;
}) => {
  const exportPayload = buildCompactComparisonExport(payload);
  const reportsDir = path.join(process.cwd(), 'reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backtest-compare-${sanitizeFilenamePart(payload.symbol)}-${timestamp}.json`;
  const filePath = path.join(reportsDir, filename);

  await mkdir(reportsDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(exportPayload, null, 2), 'utf8');

  return {
    filePath,
    fileName: filename
  };
};

export const backtestService = {
  async runBacktest(options: RunBacktestOptions = {}) {
    const params = buildAnalysisParams(options);
    const paramsHash = buildAnalysisParamsHash(params);
    const symbolRows = await backtestRepository.listSymbols(
      options.symbols,
      options.maxSymbols
    );
    const symbols = symbolRows.map((row) => row.symbol);
    const run = await backtestRepository.createRun({
      status: 'RUNNING',
      paramsHash,
      params: params as unknown as Prisma.InputJsonValue,
      scoringVersion: env.COMPOSITE_SCORING_VERSION,
      horizons: [...BACKTEST_HORIZONS] as unknown as Prisma.InputJsonValue,
      symbols: symbols as unknown as Prisma.InputJsonValue,
      symbolCount: symbols.length
    });
    const errors: BacktestRunError[] = [];
    let snapshotCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const drawdownDiagnostics: DrawdownDiagnosticsEntry[] = [];

    try {
      for (const symbolRow of symbolRows) {
        const history = await backtestRepository.getSymbolHistory(symbolRow.symbol);
        const maxHorizon = Math.max(...BACKTEST_HORIZONS);
        const firstEligibleIndex = params.quarterlyWindow - 1;
        const lastEligibleIndex = history.length - maxHorizon - 1;
        let symbolSnapshotCount = 0;

        if (lastEligibleIndex < firstEligibleIndex) {
          skippedCount += 1;
          continue;
        }

        const snapshotBatch: Prisma.BacktestSignalSnapshotCreateManyInput[] = [];

        for (let index = firstEligibleIndex; index <= lastEligibleIndex; index += 1) {
          const asOfDate = history[index]!.date;

          if (!dateIsInRange(asOfDate, options.dateFrom, options.dateTo)) {
            continue;
          }

          if (
            options.maxSnapshotsPerSymbol !== undefined &&
            symbolSnapshotCount >= options.maxSnapshotsPerSymbol
          ) {
            break;
          }

          const entryClose = getClosePrice(history[index]!);
          if (entryClose === null || entryClose <= 0) {
            skippedCount += 1;
            continue;
          }

          try {
            const result = analyzeSymbolMetrics(
              symbolRow.symbol,
              history.slice(0, index + 1),
              params,
              'database',
              false
            );
            const outcomes = buildForwardOutcomes(history, index, entryClose);

            for (const observation of outcomes.drawdownObservations) {
              if (!observation.flaggedAsFullLoss) {
                continue;
              }

              if (drawdownDiagnostics.length < 50) {
                drawdownDiagnostics.push({
                  symbol: symbolRow.symbol,
                  asOfDate,
                  horizon: observation.horizon,
                  entryClose,
                  lowestPrice: observation.lowestPrice,
                  lowestPriceDate: observation.lowestPriceDate,
                  source: observation.source,
                  maxDrawdown: observation.maxDrawdown
                });
              }
            }

            snapshotBatch.push(
              buildSnapshotRow({
                runId: run.id,
                result,
                sectorId: symbolRow.sectorId,
                sectorName: symbolRow.displaySector ?? symbolRow.sectorName,
                outcomes: outcomes.metrics
              })
            );
            symbolSnapshotCount += 1;
          } catch (error) {
            if (error instanceof InsufficientDataError) {
              skippedCount += 1;
              continue;
            }

            errorCount += 1;
            if (errors.length < 50) {
              errors.push({
                symbol: symbolRow.symbol,
                asOfDate,
                reason: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }

        snapshotCount += await backtestRepository.saveSnapshots(snapshotBatch);
      }

      const completedRun = await backtestRepository.updateRun(run.id, {
        status: 'COMPLETED',
        snapshotCount,
        skippedCount,
        errorCount,
        errors: errors as unknown as Prisma.InputJsonValue,
        finishedAt: new Date()
      });

      if (drawdownDiagnostics.length > 0) {
        logger.warn(
          {
            runId: run.id,
            totalFlaggedCases: drawdownDiagnostics.length,
            sample: drawdownDiagnostics.slice(0, 10)
          },
          'Detected near-full-loss drawdown cases during backtest'
        );
      }

      return {
        status: 'OK',
        run: buildRunSummary(completedRun),
        diagnostics: {
          drawdown: drawdownDiagnostics
        }
      };
    } catch (error) {
      logger.error({ err: error, runId: run.id }, 'Backtest run failed');
      const failedRun = await backtestRepository.updateRun(run.id, {
        status: 'FAILED',
        snapshotCount,
        skippedCount,
        errorCount: errorCount + 1,
        errors: [
          ...errors,
          {
            symbol: 'RUN',
            reason: error instanceof Error ? error.message : String(error)
          }
        ] as unknown as Prisma.InputJsonValue,
        finishedAt: new Date()
      });

      return {
        status: 'ERROR',
        run: buildRunSummary(failedRun)
      };
    }
  },

  async getReport(options: BacktestReportOptions = {}) {
    const latestRunFilters: {
      scoringVersion?: number;
      paramsHash?: string;
    } = {};

    if (options.scoringVersion !== undefined) {
      latestRunFilters.scoringVersion = options.scoringVersion;
    }

    if (options.paramsHash !== undefined) {
      latestRunFilters.paramsHash = options.paramsHash;
    }

    const run = options.runId
      ? await backtestRepository.getRun(options.runId)
      : await backtestRepository.getLatestCompletedRun(latestRunFilters);

    if (!run) {
      return null;
    }

    const limit = options.limit ?? 50000;
    const filters: BacktestReportSnapshotFilters = {
      runId: run.id
    };

    if (options.symbols !== undefined) filters.symbols = options.symbols;
    if (options.dateFrom !== undefined) filters.dateFrom = options.dateFrom;
    if (options.dateTo !== undefined) filters.dateTo = options.dateTo;
    if (options.sectorName !== undefined) filters.sectorName = options.sectorName;
    if (options.compositeAction !== undefined) {
      filters.compositeAction = options.compositeAction;
    }
    if (options.compositeBias !== undefined) {
      filters.compositeBias = options.compositeBias;
    }
    if (options.entryTiming !== undefined) filters.entryTiming = options.entryTiming;
    if (options.liquidityBucket !== undefined) {
      filters.liquidityBucket = options.liquidityBucket;
    }
    if (options.volatilityRegime !== undefined) {
      filters.volatilityRegime = options.volatilityRegime;
    }
    if (options.timeframe !== undefined) filters.timeframe = options.timeframe;
    if (options.forNewPosition !== undefined) {
      filters.forNewPosition = options.forNewPosition;
    }
    if (options.forExistingPosition !== undefined) {
      filters.forExistingPosition = options.forExistingPosition;
    }
    if (options.minScore !== undefined) filters.minScore = options.minScore;
    if (options.maxScore !== undefined) filters.maxScore = options.maxScore;
    const [totalMatchedSnapshots, snapshots] = await Promise.all([
      backtestRepository.countSnapshots(filters),
      backtestRepository.getSnapshots(filters, limit)
    ]);

    return {
      status: 'OK',
      run: buildRunSummary(run),
      filters: {
        ...filters,
        scoringVersion: options.scoringVersion,
        paramsHash: options.paramsHash,
        groupBy: options.groupBy,
        limit
      },
      totalMatchedSnapshots,
      returnedSnapshots: snapshots.length,
      truncated: snapshots.length < totalMatchedSnapshots,
      report: buildBacktestReport(snapshots, options.groupBy)
    };
  },

  async compareBacktests(options: CompareBacktestsOptions) {
    const variantKeys =
      options.variants && options.variants.length > 0
        ? options.variants
        : (Object.keys(
            backtestComparisonVariants
          ) as BacktestComparisonVariantKey[]);
    const comparisons = [];

    for (const variantKey of variantKeys) {
      const variant = backtestComparisonVariants[variantKey];
      const runOptions: RunBacktestOptions = {
        symbols: [options.symbol]
      };
      if (variant.indicatorMode !== undefined) {
        runOptions.indicatorMode = variant.indicatorMode;
      }
      if (variant.disabledIndicators !== undefined) {
        runOptions.disabledIndicators = variant.disabledIndicators;
      }

      if (options.dateFrom !== undefined) runOptions.dateFrom = options.dateFrom;
      if (options.dateTo !== undefined) runOptions.dateTo = options.dateTo;
      if (options.maxSnapshotsPerSymbol !== undefined) {
        runOptions.maxSnapshotsPerSymbol = options.maxSnapshotsPerSymbol;
      }
      if (options.weeklyWindow !== undefined) {
        runOptions.weeklyWindow = options.weeklyWindow;
      }
      if (options.monthlyWindow !== undefined) {
        runOptions.monthlyWindow = options.monthlyWindow;
      }
      if (options.quarterlyWindow !== undefined) {
        runOptions.quarterlyWindow = options.quarterlyWindow;
      }
      if (options.includeRealLegal !== undefined) {
        runOptions.includeRealLegal = options.includeRealLegal;
      }
      if (options.scoringOverrides !== undefined) {
        runOptions.scoringOverrides = options.scoringOverrides;
      }

      const runResult = await this.runBacktest(runOptions);
      const reportResult =
        runResult.status === 'OK'
          ? await this.getReport({
              runId: runResult.run.id,
              limit: options.reportLimit ?? 50000
            })
          : null;

      comparisons.push({
        key: variantKey,
        config: variant,
        run: runResult.run,
        report: reportResult?.report ?? null,
        drawdownDiagnostics:
          runResult.status === 'OK' ? runResult.diagnostics?.drawdown ?? [] : [],
        totalMatchedSnapshots: reportResult?.totalMatchedSnapshots ?? null,
        returnedSnapshots: reportResult?.returnedSnapshots ?? null,
        truncated: reportResult?.truncated ?? null
      });
    }

    const exportInfo = await writeCompactComparisonExport({
      symbol: options.symbol,
      comparisons: comparisons.map((variant) => ({
        key: variant.key,
        config: variant.config,
        run: variant.run,
        report: variant.report,
        drawdownDiagnostics: variant.drawdownDiagnostics
      }))
    });

    return {
      status: 'OK' as const,
      symbol: options.symbol,
      comparisonCount: comparisons.length,
      variants: comparisons,
      compactReport: exportInfo
    };
  }
};
