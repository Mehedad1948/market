import type { SymbolDailyMetric } from '@prisma/client';

import { env } from '../config/env';
import type {
  AnalysisConfidence,
  AnalysisRegime,
  BuyTimeframes,
  LiquidityMetrics,
  MovingAverageAnalysis,
  StockAnalysisResult,
  SymbolAnalysisParams
} from '../types';
import { round } from '../utils/number';
import {
  calculateSlope,
  calculateSmaSeries,
  detectCrossAbove,
  detectCrossBelow
} from './movingAverage.service';
import { analysisDisclaimer, buildPersianSummary } from './persianSemantic.service';

const toNumber = (value: { toString(): string } | null): number | null => {
  return value === null ? null : Number(value.toString());
};

export class InsufficientDataError extends Error {
  constructor() {
    super('Insufficient historical data.');
    this.name = 'InsufficientDataError';
  }
}

export const isAboveBy = (a: number, b: number, threshold = 0.02): boolean => {
  return a > b * (1 + threshold);
};

export const calculateBuyTimeframes = (
  metrics: LiquidityMetrics,
  threshold = 0.02
): BuyTimeframes => {
  const {
    latestTradeValue,
    maWeekly,
    maMonthly,
    maQuarterly,
    weeklySlope,
    monthlySlope,
    quarterlySlope
  } = metrics;

  return {
    shortTerm:
      isAboveBy(maWeekly, maMonthly, threshold) &&
      weeklySlope > 0 &&
      latestTradeValue > maWeekly,
    midTerm:
      isAboveBy(maMonthly, maQuarterly, threshold) &&
      monthlySlope > 0 &&
      latestTradeValue > maMonthly,
    longTerm:
      quarterlySlope > 0 &&
      maMonthly > maQuarterly &&
      latestTradeValue > maQuarterly
  };
};

export const classifyRegime = (
  metrics: MovingAverageAnalysis
): AnalysisRegime => {
  const {
    maWeekly,
    maMonthly,
    maQuarterly,
    monthlySlope,
    crossWeeklyAboveMonthly,
    crossWeeklyBelowMonthly,
    crossMonthlyAboveQuarterly
  } = metrics;

  if (maWeekly > maMonthly && maMonthly > maQuarterly && monthlySlope > 0) {
    return 'STRONG_BULLISH_LIQUIDITY';
  }

  if (crossWeeklyAboveMonthly && !(maMonthly > maQuarterly)) {
    return 'EARLY_BULLISH';
  }

  if (crossMonthlyAboveQuarterly) {
    return 'CONFIRMED_BULLISH';
  }

  if (crossWeeklyBelowMonthly) {
    return 'SHORT_TERM_WARNING';
  }

  if (maWeekly < maMonthly && maMonthly < maQuarterly && monthlySlope < 0) {
    return 'BEARISH_LIQUIDITY';
  }

  return 'NEUTRAL';
};

export const calculateConfidence = (
  regime: AnalysisRegime,
  metrics: MovingAverageAnalysis
): AnalysisConfidence => {
  const bullishOrder =
    metrics.maWeekly > metrics.maMonthly && metrics.maMonthly > metrics.maQuarterly;
  const bearishOrder =
    metrics.maWeekly < metrics.maMonthly && metrics.maMonthly < metrics.maQuarterly;
  const positiveSlopes =
    metrics.weeklySlope > 0 && metrics.monthlySlope > 0 && metrics.quarterlySlope >= 0;
  const negativeSlopes =
    metrics.weeklySlope < 0 && metrics.monthlySlope < 0 && metrics.quarterlySlope <= 0;
  const hasBullishCross =
    metrics.crossWeeklyAboveMonthly || metrics.crossMonthlyAboveQuarterly;
  const hasBearishCross = metrics.crossWeeklyBelowMonthly || metrics.crossMonthlyBelowQuarterly;

  if (
    (regime === 'STRONG_BULLISH_LIQUIDITY' && bullishOrder && positiveSlopes && hasBullishCross) ||
    (regime === 'BEARISH_LIQUIDITY' && bearishOrder && negativeSlopes && hasBearishCross) ||
    (regime === 'CONFIRMED_BULLISH' && metrics.crossMonthlyAboveQuarterly && metrics.monthlySlope > 0)
  ) {
    return 'HIGH';
  }

  if (
    metrics.crossWeeklyAboveMonthly ||
    metrics.crossWeeklyBelowMonthly ||
    metrics.crossMonthlyAboveQuarterly ||
    metrics.crossMonthlyBelowQuarterly ||
    regime === 'STRONG_BULLISH_LIQUIDITY' ||
    regime === 'BEARISH_LIQUIDITY'
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
};

export const analyzeSymbolMetrics = (
  symbol: string,
  rows: SymbolDailyMetric[],
  params: SymbolAnalysisParams,
  source: 'database' | 'brsapi' | 'mixed',
  cacheHit: boolean
): StockAnalysisResult => {
  if (rows.length < params.quarterlyWindow) {
    throw new InsufficientDataError();
  }

  const values = rows
    .map((row) => toNumber(row.tradeValue))
    .filter((value): value is number => value !== null);

  if (values.length < params.quarterlyWindow) {
    throw new InsufficientDataError();
  }

  const weeklySeries = calculateSmaSeries(values, params.weeklyWindow);
  const monthlySeries = calculateSmaSeries(values, params.monthlyWindow);
  const quarterlySeries = calculateSmaSeries(values, params.quarterlyWindow);

  const maWeekly = weeklySeries.at(-1);
  const maMonthly = monthlySeries.at(-1);
  const maQuarterly = quarterlySeries.at(-1);

  if (
    maWeekly === null ||
    maWeekly === undefined ||
    maMonthly === null ||
    maMonthly === undefined ||
    maQuarterly === null ||
    maQuarterly === undefined
  ) {
    throw new InsufficientDataError();
  }

  const movingAverageAnalysis: MovingAverageAnalysis = {
    maWeekly: round(maWeekly),
    maMonthly: round(maMonthly),
    maQuarterly: round(maQuarterly),
    weeklySlope: calculateSlope(weeklySeries),
    monthlySlope: calculateSlope(monthlySeries),
    quarterlySlope: calculateSlope(quarterlySeries),
    crossWeeklyAboveMonthly: detectCrossAbove(weeklySeries, monthlySeries),
    crossWeeklyBelowMonthly: detectCrossBelow(weeklySeries, monthlySeries),
    crossMonthlyAboveQuarterly: detectCrossAbove(monthlySeries, quarterlySeries),
    crossMonthlyBelowQuarterly: detectCrossBelow(monthlySeries, quarterlySeries)
  };

  const regime = classifyRegime(movingAverageAnalysis);
  const confidence = calculateConfidence(regime, movingAverageAnalysis);
  const latestRow = rows.at(-1);

  if (!latestRow) {
    throw new InsufficientDataError();
  }

  const latestTradeValue = toNumber(latestRow.tradeValue);
  const latestClosePrice = toNumber(latestRow.closePrice);
  const latestClosePriceChangePercent = toNumber(latestRow.closePriceChangePercent);
  const valueChangeVsMonthly =
    latestTradeValue !== null && movingAverageAnalysis.maMonthly !== 0
      ? round(
          (latestTradeValue - movingAverageAnalysis.maMonthly) /
            Math.abs(movingAverageAnalysis.maMonthly)
        )
      : null;
  const valueChangeVsQuarterly =
    latestTradeValue !== null && movingAverageAnalysis.maQuarterly !== 0
      ? round(
          (latestTradeValue - movingAverageAnalysis.maQuarterly) /
            Math.abs(movingAverageAnalysis.maQuarterly)
        )
      : null;

  const buy = calculateBuyTimeframes(
    {
      latestTradeValue: latestTradeValue ?? 0,
      maWeekly: movingAverageAnalysis.maWeekly,
      maMonthly: movingAverageAnalysis.maMonthly,
      maQuarterly: movingAverageAnalysis.maQuarterly,
      weeklySlope: movingAverageAnalysis.weeklySlope,
      monthlySlope: movingAverageAnalysis.monthlySlope,
      quarterlySlope: movingAverageAnalysis.quarterlySlope
    },
    env.BUY_THRESHOLD_PERCENT
  );

  return {
    status: 'OK',
    symbol,
    source,
    cacheHit,
    latestDataDate: latestRow.date,
    windows: {
      weekly: params.weeklyWindow,
      monthly: params.monthlyWindow,
      quarterly: params.quarterlyWindow
    },
    metrics: {
      latestTradeValue,
      latestClosePrice,
      latestClosePriceChangePercent,
      maWeekly: movingAverageAnalysis.maWeekly,
      maMonthly: movingAverageAnalysis.maMonthly,
      maQuarterly: movingAverageAnalysis.maQuarterly,
      weeklySlope: movingAverageAnalysis.weeklySlope,
      monthlySlope: movingAverageAnalysis.monthlySlope,
      quarterlySlope: movingAverageAnalysis.quarterlySlope,
      valueChangeVsMonthly,
      valueChangeVsQuarterly
    },
    signals: {
      regime,
      crossWeeklyAboveMonthly: movingAverageAnalysis.crossWeeklyAboveMonthly,
      crossWeeklyBelowMonthly: movingAverageAnalysis.crossWeeklyBelowMonthly,
      crossMonthlyAboveQuarterly: movingAverageAnalysis.crossMonthlyAboveQuarterly,
      crossMonthlyBelowQuarterly: movingAverageAnalysis.crossMonthlyBelowQuarterly,
      confidence,
      buy
    },
    persianSummary: buildPersianSummary(symbol, regime, confidence, buy),
    disclaimer: analysisDisclaimer
  };
};
