import type { SymbolDailyMetric } from '@prisma/client';

import { env } from '../config/env';
import type {
  AnalysisConfidence,
  CompositeSignal,
  AnalysisRegime,
  BuyTimeframes,
  LiquidityMetrics,
  MovingAverageAnalysis,
  SellTimeframes,
  StochRsiAnalysis,
  StochRsiConfig,
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
import {
  analysisDisclaimer,
  buildPersianSummary
} from './persianSemantic.service';
import { calculateStochRsiAnalysis } from './stochRsi.service';

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
    metrics.maWeekly > metrics.maMonthly &&
    metrics.maMonthly > metrics.maQuarterly;
  const bearishOrder =
    metrics.maWeekly < metrics.maMonthly &&
    metrics.maMonthly < metrics.maQuarterly;
  const positiveSlopes =
    metrics.weeklySlope > 0 &&
    metrics.monthlySlope > 0 &&
    metrics.quarterlySlope >= 0;
  const negativeSlopes =
    metrics.weeklySlope < 0 &&
    metrics.monthlySlope < 0 &&
    metrics.quarterlySlope <= 0;
  const hasBullishCross =
    metrics.crossWeeklyAboveMonthly || metrics.crossMonthlyAboveQuarterly;
  const hasBearishCross =
    metrics.crossWeeklyBelowMonthly || metrics.crossMonthlyBelowQuarterly;

  if (
    (regime === 'STRONG_BULLISH_LIQUIDITY' &&
      bullishOrder &&
      positiveSlopes &&
      hasBullishCross) ||
    (regime === 'BEARISH_LIQUIDITY' &&
      bearishOrder &&
      negativeSlopes &&
      hasBearishCross) ||
    (regime === 'CONFIRMED_BULLISH' &&
      metrics.crossMonthlyAboveQuarterly &&
      metrics.monthlySlope > 0)
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

export const getStochRsiConfig = (): StochRsiConfig => {
  return {
    rsiLength: env.STOCH_RSI_RSI_LENGTH,
    stochLength: env.STOCH_RSI_STOCH_LENGTH,
    kSmooth: env.STOCH_RSI_K_SMOOTH,
    dSmooth: env.STOCH_RSI_D_SMOOTH,
    upper: env.STOCH_RSI_UPPER,
    lower: env.STOCH_RSI_LOWER,
    sellLookback: env.STOCH_RSI_SELL_LOOKBACK,
    buyLookback: env.STOCH_RSI_BUY_LOOKBACK,
    signalMaxAge: env.STOCH_RSI_SIGNAL_MAX_AGE,
    minCrossDistance: env.STOCH_RSI_MIN_CROSS_DISTANCE
  };
};

export const calculateSellTimeframes = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  stochRsi: StochRsiAnalysis
): SellTimeframes => {
  return {
    shortTerm: stochRsi.riskSell || regime === 'SHORT_TERM_WARNING',
    midTerm:
      stochRsi.confirmedSell &&
      (regime === 'SHORT_TERM_WARNING' ||
        regime === 'BEARISH_LIQUIDITY' ||
        !buy.midTerm),
    longTerm: regime === 'BEARISH_LIQUIDITY' && stochRsi.confirmedSell
  };
};

const clampScore = (score: number): number => {
  return Math.max(-100, Math.min(100, score));
};

export const calculateCompositeSignal = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  stochRsi: StochRsiAnalysis
): CompositeSignal => {
  const activeSellSignal = stochRsi.riskSell || stochRsi.confirmedSell;
  const bullishRegime =
    regime === 'STRONG_BULLISH_LIQUIDITY' ||
    regime === 'EARLY_BULLISH' ||
    regime === 'CONFIRMED_BULLISH';
  const strongBuy =
    stochRsi.probableBuy &&
    buy.shortTerm &&
    buy.midTerm &&
    regime !== 'BEARISH_LIQUIDITY' &&
    !stochRsi.confirmedSell;
  const probableBuy =
    stochRsi.probableBuy &&
    regime !== 'BEARISH_LIQUIDITY' &&
    (buy.shortTerm ||
      regime === 'EARLY_BULLISH' ||
      regime === 'CONFIRMED_BULLISH');
  const confirmedSell =
    stochRsi.confirmedSell &&
    (regime === 'SHORT_TERM_WARNING' ||
      regime === 'BEARISH_LIQUIDITY' ||
      !buy.midTerm);
  const riskSell = stochRsi.riskSell && !buy.shortTerm;
  const caution =
    (stochRsi.riskSell && !stochRsi.confirmedSell) ||
    regime === 'SHORT_TERM_WARNING';
  const hold = bullishRegime && !activeSellSignal && !stochRsi.probableBuy;

  let action: CompositeSignal['action'] = 'HOLD';
  let explanationKey = 'composite.hold';

  if (confirmedSell) {
    action = 'CONFIRMED_SELL';
    explanationKey = 'composite.confirmedSell';
  } else if (riskSell) {
    action = 'RISK_SELL';
    explanationKey = 'composite.riskSell';
  } else if (strongBuy) {
    action = 'STRONG_BUY';
    explanationKey = 'composite.strongBuy';
  } else if (caution) {
    action = 'CAUTION';
    explanationKey = 'composite.caution';
  } else if (probableBuy) {
    action = 'PROBABLE_BUY';
    explanationKey = 'composite.probableBuy';
  } else if (hold) {
    action = 'HOLD';
    explanationKey = 'composite.hold';
  }

  const score = clampScore(
    (buy.shortTerm ? 25 : 0) +
      (buy.midTerm ? 25 : 0) +
      (buy.longTerm ? 15 : 0) +
      (stochRsi.probableBuy ? 25 : 0) -
      (stochRsi.riskSell ? 25 : 0) -
      (stochRsi.confirmedSell ? 35 : 0) -
      (regime === 'SHORT_TERM_WARNING' ? 20 : 0) -
      (regime === 'BEARISH_LIQUIDITY' ? 35 : 0)
  );

  return {
    action,
    score,
    explanationKey
  };
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
    crossMonthlyAboveQuarterly: detectCrossAbove(
      monthlySeries,
      quarterlySeries
    ),
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
  const latestClosePriceChangePercent = toNumber(
    latestRow.closePriceChangePercent
  );
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
  const stochRsi = calculateStochRsiAnalysis(rows, getStochRsiConfig());
  const sell = calculateSellTimeframes(regime, buy, stochRsi);
  const composite = calculateCompositeSignal(regime, buy, stochRsi);

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
      crossMonthlyAboveQuarterly:
        movingAverageAnalysis.crossMonthlyAboveQuarterly,
      crossMonthlyBelowQuarterly:
        movingAverageAnalysis.crossMonthlyBelowQuarterly,
      confidence,
      buy,
      sell,
      stochRsi,
      composite
    },
    persianSummary: buildPersianSummary(
      symbol,
      regime,
      confidence,
      buy,
      stochRsi,
      composite
    ),
    disclaimer: analysisDisclaimer
  };
};
