import type { SymbolDailyMetric } from '@prisma/client';

import { env } from '../config/env';
import type {
  AdxAnalysis,
  AnalysisConfidence,
  AnalysisRegime,
  AtrAnalysis,
  BuyTimeframes,
  CompositeSignal,
  LiquidityConfirmation,
  LiquidityMetrics,
  MovingAverageAnalysis,
  PriceTrendAnalysis,
  PriceTrendConfig,
  SellTimeframes,
  StochRsiAnalysis,
  StochRsiConfig,
  StockAnalysisResult,
  SymbolAnalysisParams
} from '../types';
import { sortByDateAsc } from '../utils/dateSort';
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
import { calculatePriceTrendAnalysis } from './priceTrend.service';
import { calculateStochRsiAnalysis } from './stochRsi.service';
import {
  calculateAdxAnalysis,
  calculateAtrAnalysis
} from './technicalIndicators.service';

const toNumber = (value: { toString(): string } | null): number | null => {
  return value === null ? null : Number(value.toString());
};

export class InsufficientDataError extends Error {
  constructor(message = 'Insufficient historical data.') {
    super(message);
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

export const getPriceTrendConfig = (): PriceTrendConfig => {
  return {
    fastWindow: env.PRICE_FAST_MA_WINDOW,
    midWindow: env.PRICE_MID_MA_WINDOW,
    longWindow: env.PRICE_LONG_MA_WINDOW,
    maType: env.PRICE_MA_TYPE,
    minSlope: env.PRICE_TREND_MIN_SLOPE
  };
};

export const buildAnalysisConfigForCache = () => {
  return {
    buyThresholdPercent: env.BUY_THRESHOLD_PERCENT,
    compositeScoringVersion: env.COMPOSITE_SCORING_VERSION,
    atr: {
      period: env.ATR_PERIOD,
      lowVolatilityThreshold: env.ATR_LOW_VOLATILITY_THRESHOLD,
      highVolatilityThreshold: env.ATR_HIGH_VOLATILITY_THRESHOLD
    },
    adx: {
      period: env.ADX_PERIOD
    },
    liquidityConfirmation: {
      window: env.LIQUIDITY_CONFIRMATION_WINDOW,
      expansionThreshold: env.LIQUIDITY_EXPANSION_THRESHOLD,
      contractionThreshold: env.LIQUIDITY_CONTRACTION_THRESHOLD
    },
    stochRsi: getStochRsiConfig(),
    priceTrend: getPriceTrendConfig()
  };
};

export const calculateSellTimeframes = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  stochRsi: StochRsiAnalysis,
  priceTrend: PriceTrendAnalysis
): SellTimeframes => {
  return {
    shortTerm:
      stochRsi.riskSell ||
      stochRsi.confirmedSell ||
      priceTrend.warning ||
      regime === 'SHORT_TERM_WARNING',
    midTerm:
      stochRsi.confirmedSell &&
      (!buy.midTerm ||
        priceTrend.bearish ||
        regime === 'SHORT_TERM_WARNING' ||
        regime === 'BEARISH_LIQUIDITY'),
    longTerm:
      regime === 'BEARISH_LIQUIDITY' &&
      stochRsi.confirmedSell &&
      priceTrend.bearish
  };
};

const clampScore = (score: number): number => {
  return Math.max(-100, Math.min(100, score));
};

export const calculateCompositeSignal = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  stochRsi: StochRsiAnalysis,
  priceTrend: PriceTrendAnalysis,
  adx?: AdxAnalysis,
  atr?: AtrAnalysis,
  liquidityConfirmation?: LiquidityConfirmation
): CompositeSignal => {
  const activeSellSignal = stochRsi.riskSell || stochRsi.confirmedSell;
  const bullishRegime =
    regime === 'STRONG_BULLISH_LIQUIDITY' ||
    regime === 'EARLY_BULLISH' ||
    regime === 'CONFIRMED_BULLISH';
  const liquidityRegimeIsBullishOrNeutral =
    bullishRegime || regime === 'NEUTRAL';
  const confirmedSell =
    stochRsi.confirmedSell &&
    (priceTrend.bearish ||
      regime === 'SHORT_TERM_WARNING' ||
      regime === 'BEARISH_LIQUIDITY' ||
      !buy.midTerm);
  const confirmedSellButTrendStrong =
    stochRsi.confirmedSell &&
    regime === 'STRONG_BULLISH_LIQUIDITY' &&
    buy.midTerm &&
    !priceTrend.bearish;
  const riskSell = stochRsi.riskSell && (!buy.shortTerm || priceTrend.warning);
  const caution =
    stochRsi.riskSell || regime === 'SHORT_TERM_WARNING' || priceTrend.warning;
  const strongBuy =
    stochRsi.probableBuy &&
    buy.shortTerm &&
    buy.midTerm &&
    priceTrend.bullish &&
    regime !== 'BEARISH_LIQUIDITY' &&
    !stochRsi.riskSell &&
    !stochRsi.confirmedSell;
  const probableBuy =
    stochRsi.probableBuy &&
    regime !== 'BEARISH_LIQUIDITY' &&
    !stochRsi.confirmedSell &&
    (buy.shortTerm ||
      regime === 'EARLY_BULLISH' ||
      regime === 'CONFIRMED_BULLISH' ||
      priceTrend.direction === 'IMPROVING');
  const hold =
    liquidityRegimeIsBullishOrNeutral &&
    !activeSellSignal &&
    !stochRsi.probableBuy;
  const adxWeak = adx?.trendStrength === 'WEAK';
  const adxStrongBullish =
    adx?.trendStrength === 'STRONG' && adx.bullishDirectionalBias;
  const adxStrongBearish =
    adx?.trendStrength === 'STRONG' && adx.bearishDirectionalBias;
  const highAtr = atr?.volatilityRegime === 'HIGH';

  let action: CompositeSignal['action'] = 'CAUTION';
  let explanationKey = 'composite.caution';

  if (confirmedSell) {
    action = 'CONFIRMED_SELL';
    explanationKey = 'composite.confirmedSell';
  } else if (confirmedSellButTrendStrong) {
    action = 'CAUTION';
    explanationKey = 'composite.confirmedSellButTrendStrong';
  } else if (riskSell) {
    action = 'RISK_SELL';
    explanationKey = 'composite.riskSell';
  } else if (caution) {
    action = 'CAUTION';
    explanationKey = 'composite.caution';
  } else if (strongBuy) {
    action = 'STRONG_BUY';
    explanationKey = 'composite.strongBuy';
  } else if (probableBuy) {
    action = 'PROBABLE_BUY';
    explanationKey = 'composite.probableBuy';
  } else if (hold) {
    action = 'HOLD';
    explanationKey = 'composite.hold';
  }

  if (action === 'STRONG_BUY' && (adxWeak || highAtr || adxStrongBearish)) {
    action = adxStrongBearish || highAtr ? 'CAUTION' : 'PROBABLE_BUY';
    explanationKey =
      adxWeak && !highAtr && !adxStrongBearish
        ? 'composite.strongBuyDowngradedByAdx'
        : highAtr
          ? 'composite.strongBuyDowngradedByAtr'
          : 'composite.strongBuyDowngradedByAdx';
  }

  if (action === 'PROBABLE_BUY' && adxStrongBearish) {
    action = 'CAUTION';
    explanationKey = 'composite.caution';
  }

  const stochPenalty = stochRsi.confirmedSell
    ? -50
    : stochRsi.riskSell
      ? -25
      : 0;
  const score = clampScore(
    (buy.shortTerm ? 20 : 0) +
      (buy.midTerm ? 25 : 0) +
      (buy.longTerm ? 15 : 0) +
      (stochRsi.probableBuy ? 20 : 0) +
      (priceTrend.direction === 'BULLISH' ? 20 : 0) +
      (priceTrend.direction === 'IMPROVING' ? 10 : 0) +
      (adxWeak ? -10 : 0) +
      (adxStrongBullish ? 5 : 0) +
      (adxStrongBearish ? -10 : 0) +
      (highAtr ? -10 : 0) +
      (liquidityConfirmation?.liquidityExpansion ? 5 : 0) +
      (liquidityConfirmation?.liquidityContraction ? -5 : 0) +
      stochPenalty -
      (regime === 'SHORT_TERM_WARNING' ? 20 : 0) -
      (regime === 'BEARISH_LIQUIDITY' ? 35 : 0) -
      (priceTrend.direction === 'BEARISH' ? 25 : 0) -
      (priceTrend.direction === 'WEAKENING' ? 10 : 0)
  );

  return {
    action,
    score,
    explanationKey,
    scoreScale: {
      min: -100,
      max: 100
    }
  };
};

const calculateRelativeLiquidity = (
  values: number[],
  window: number
): LiquidityConfirmation => {
  const recentValues = values.slice(-window);

  if (recentValues.length < window) {
    return {
      relativeTradeValue20: null,
      liquidityExpansion: false,
      liquidityContraction: false
    };
  }

  const latestTradeValue = recentValues.at(-1);

  if (latestTradeValue === undefined) {
    return {
      relativeTradeValue20: null,
      liquidityExpansion: false,
      liquidityContraction: false
    };
  }

  const averageTradeValue =
    recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
  const relativeTradeValue20 =
    averageTradeValue === 0 ? null : round(latestTradeValue / averageTradeValue);

  return {
    relativeTradeValue20,
    liquidityExpansion:
      relativeTradeValue20 !== null &&
      relativeTradeValue20 >= env.LIQUIDITY_EXPANSION_THRESHOLD,
    liquidityContraction:
      relativeTradeValue20 !== null &&
      relativeTradeValue20 <= env.LIQUIDITY_CONTRACTION_THRESHOLD
  };
};

// Future improvements:
// - relative strength requires index or sector benchmark time series
// - real/legal money flow requires SymbolRealLegalDaily joins in analysis
// - support/resistance needs pivot detection plus backtesting

export const analyzeSymbolMetrics = (
  symbol: string,
  rows: SymbolDailyMetric[],
  params: SymbolAnalysisParams,
  source: 'database' | 'brsapi' | 'mixed',
  cacheHit: boolean
): StockAnalysisResult => {
  const sortedRows = sortByDateAsc(rows);

  if (sortedRows.length < params.quarterlyWindow) {
    throw new InsufficientDataError();
  }

  const values = sortedRows
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
  const latestRow = sortedRows.at(-1);

  if (!latestRow) {
    throw new InsufficientDataError();
  }

  const latestTradeValue = toNumber(latestRow.tradeValue);
  if (latestTradeValue === null) {
    throw new InsufficientDataError('Latest trade value is missing.');
  }

  const latestClosePrice = toNumber(latestRow.closePrice);
  const latestClosePriceChangePercent = toNumber(
    latestRow.closePriceChangePercent
  );
  const liquidityConfirmation = calculateRelativeLiquidity(
    values,
    env.LIQUIDITY_CONFIRMATION_WINDOW
  );
  const valueChangeVsMonthly =
    movingAverageAnalysis.maMonthly !== 0
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
      latestTradeValue,
      maWeekly: movingAverageAnalysis.maWeekly,
      maMonthly: movingAverageAnalysis.maMonthly,
      maQuarterly: movingAverageAnalysis.maQuarterly,
      weeklySlope: movingAverageAnalysis.weeklySlope,
      monthlySlope: movingAverageAnalysis.monthlySlope,
      quarterlySlope: movingAverageAnalysis.quarterlySlope
    },
    env.BUY_THRESHOLD_PERCENT
  );
  const stochRsi = calculateStochRsiAnalysis(sortedRows, getStochRsiConfig());
  const priceTrend = calculatePriceTrendAnalysis(
    sortedRows,
    getPriceTrendConfig()
  );
  const atr = calculateAtrAnalysis(
    sortedRows,
    env.ATR_PERIOD,
    env.ATR_LOW_VOLATILITY_THRESHOLD,
    env.ATR_HIGH_VOLATILITY_THRESHOLD
  );
  const adx = calculateAdxAnalysis(sortedRows, env.ADX_PERIOD);
  const sell = calculateSellTimeframes(regime, buy, stochRsi, priceTrend);
  const composite = calculateCompositeSignal(
    regime,
    buy,
    stochRsi,
    priceTrend,
    adx,
    atr,
    liquidityConfirmation
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
      valueChangeVsQuarterly,
      relativeTradeValue20: liquidityConfirmation.relativeTradeValue20,
      liquidityExpansion: liquidityConfirmation.liquidityExpansion,
      liquidityContraction: liquidityConfirmation.liquidityContraction
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
      priceTrend,
      adx,
      atr,
      composite
    },
    persianSummary: buildPersianSummary(
      symbol,
      regime,
      confidence,
      buy,
      stochRsi,
      composite,
      priceTrend,
      adx,
      atr,
      liquidityConfirmation
    ),
    disclaimer: analysisDisclaimer
  };
};
