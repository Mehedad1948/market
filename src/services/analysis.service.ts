import type { SymbolDailyMetric } from '@prisma/client';

import { env } from '../config/env';
import type {
  AdxAnalysis,
  AdxDirectionalBiasValue,
  AnalysisConfidence,
  AnalysisRegime,
  AtrAnalysis,
  BuyTimeframes,
  CompositeBias,
  CompositeEntryTiming,
  CompositeSignal,
  CompositeTimeframes,
  LiquidityConfirmation,
  LiquidityMetrics,
  LabeledValue,
  MovingAverageAnalysis,
  PriceTrendAnalysis,
  PriceTrendConfig,
  SellTimeframes,
  StockAnalysisSignals,
  StochRsiAnalysis,
  StochRsiConfig,
  StockAnalysisResult,
  SymbolAnalysisParams,
  TimeframeAction,
  TimeframeComposite,
  TimeframeQuality
} from '../types';
import { createHash } from '../utils/hash';
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

const ANALYSIS_CACHE_SIGNATURE = 'signals-labeled-values';

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

export const buildAnalysisParamsHash = (
  params: Pick<
    SymbolAnalysisParams,
    'weeklyWindow' | 'monthlyWindow' | 'quarterlyWindow' | 'includeRealLegal'
  >
) => {
  return createHash({
    weeklyWindow: params.weeklyWindow,
    monthlyWindow: params.monthlyWindow,
    quarterlyWindow: params.quarterlyWindow,
    includeRealLegal: params.includeRealLegal,
    analysisConfig: buildAnalysisConfigForCache(),
    cacheSignature: ANALYSIS_CACHE_SIGNATURE
  });
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
  return Math.max(-100, Math.min(100, Math.round(score)));
};

const classifyBias = (score: number): CompositeBias => {
  if (score >= 70) return 'STRONG_BULLISH';
  if (score >= 35) return 'BULLISH';
  if (score <= -70) return 'STRONG_BEARISH';
  if (score <= -35) return 'BEARISH';
  return 'NEUTRAL';
};

const classifyTimeframeQuality = (score: number): TimeframeQuality => {
  if (score >= 70) return 'STRONG_BULLISH';
  if (score >= 35) return 'BULLISH';
  if (score <= -35) return 'BEARISH';
  if (score <= 10) return 'WEAK';
  return 'NEUTRAL';
};

const classifyEntryTiming = (
  action: CompositeSignal['action']
): CompositeEntryTiming => {
  if (action === 'STRONG_BUY') return 'READY';
  if (action === 'PROBABLE_BUY') return 'PROBABLE';
  if (action === 'HOLD') return 'NOT_READY';
  if (action === 'CAUTION' || action === 'RISK_SELL') return 'RISKY';
  return 'AVOID';
};

const labeledValue = <T>(value: T, label: string): LabeledValue<T> => ({
  label,
  value
});

const labeledBoolean = (
  value: boolean,
  trueLabel: string,
  falseLabel: string
): LabeledValue<boolean> => {
  return labeledValue(value, value ? trueLabel : falseLabel);
};

const describeLabel = (concept: string, state: string): string => {
  return `${concept}: ${state}`;
};

const regimeLabelMap: Record<AnalysisRegime, string> = {
  STRONG_BULLISH_LIQUIDITY: 'صعودی قوی',
  EARLY_BULLISH: 'شروع صعود',
  CONFIRMED_BULLISH: 'صعود تاییدشده',
  SHORT_TERM_WARNING: 'هشدار کوتاه‌مدت',
  BEARISH_LIQUIDITY: 'نزولی',
  NEUTRAL: 'خنثی'
};

const confidenceLabelMap: Record<AnalysisConfidence, string> = {
  HIGH: 'بالا',
  MEDIUM: 'متوسط',
  LOW: 'پایین'
};

const compositeActionLabelMap: Record<CompositeSignal['action'], string> = {
  STRONG_BUY: 'خرید قوی',
  PROBABLE_BUY: 'خرید احتمالی',
  HOLD: 'نگهداری',
  CAUTION: 'احتیاط',
  RISK_SELL: 'ریسک فروش',
  CONFIRMED_SELL: 'فروش تاییدشده'
};

const compositeBiasLabelMap: Record<CompositeBias, string> = {
  STRONG_BULLISH: 'صعودی قوی',
  BULLISH: 'صعودی',
  NEUTRAL: 'خنثی',
  BEARISH: 'نزولی',
  STRONG_BEARISH: 'نزولی قوی'
};

const compositeEntryTimingLabelMap: Record<CompositeEntryTiming, string> = {
  READY: 'آماده ورود',
  PROBABLE: 'احتمال ورود',
  NOT_READY: 'فعلا آماده نیست',
  RISKY: 'پرریسک',
  AVOID: 'اجتناب'
};

const timeframeActionLabelMap: Record<TimeframeAction, string> = {
  BUY: 'خرید',
  PROBABLE_BUY: 'خرید احتمالی',
  HOLD: 'نگهداری',
  WAIT: 'صبر',
  CAUTION: 'احتیاط',
  REDUCE: 'کاهش موقعیت',
  EXIT: 'خروج'
};

const timeframeQualityLabelMap: Record<TimeframeQuality, string> = {
  STRONG_BULLISH: 'صعودی قوی',
  BULLISH: 'صعودی',
  NEUTRAL: 'خنثی',
  WEAK: 'ضعیف',
  BEARISH: 'نزولی'
};

const stochRsiStatusLabelMap: Record<StochRsiAnalysis['status'], string> = {
  OK: 'آماده',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const stochRsiZoneLabelMap: Record<StochRsiAnalysis['latestZone'], string> = {
  GREEN: 'سبز',
  RED: 'قرمز',
  NEUTRAL: 'خنثی',
  UNKNOWN: 'نامشخص'
};

const priceTrendStatusLabelMap: Record<PriceTrendAnalysis['status'], string> = {
  OK: 'آماده',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const priceTrendDirectionLabelMap: Record<
  PriceTrendAnalysis['direction'],
  string
> = {
  BULLISH: 'صعودی',
  IMPROVING: 'در حال بهبود',
  NEUTRAL: 'خنثی',
  WEAKENING: 'در حال تضعیف',
  BEARISH: 'نزولی',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const adxStatusLabelMap: Record<AdxAnalysis['status'], string> = {
  OK: 'آماده',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const adxTrendStrengthLabelMap: Record<AdxAnalysis['trendStrength'], string> = {
  WEAK: 'ضعیف',
  MODERATE: 'متوسط',
  STRONG: 'قوی',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const atrStatusLabelMap: Record<AtrAnalysis['status'], string> = {
  OK: 'آماده',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const atrVolatilityLabelMap: Record<AtrAnalysis['volatilityRegime'], string> = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'زیاد',
  INSUFFICIENT_DATA: 'داده ناکافی'
};

const getAdxDirectionalBias = (
  adx: AdxAnalysis
): LabeledValue<AdxDirectionalBiasValue> => {
  if (adx.bullishDirectionalBias) {
    return labeledValue('BULLISH', describeLabel('جهت روند ADX', 'صعودی'));
  }

  if (adx.bearishDirectionalBias) {
    return labeledValue('BEARISH', describeLabel('جهت روند ADX', 'نزولی'));
  }

  return labeledValue('NEUTRAL', describeLabel('جهت روند ADX', 'خنثی'));
};

const buildTimeframeComposite = (
  score: number,
  action: TimeframeAction,
  explanationKey: string
): TimeframeComposite => {
  const normalizedScore = clampScore(score);

  return {
    score: normalizedScore,
    action,
    quality: classifyTimeframeQuality(normalizedScore),
    explanationKey
  };
};

const calculateTimeframeComposites = ({
  regime,
  buy,
  sell,
  stochRsi,
  priceTrend,
  adx,
  atr,
  liquidityConfirmation
}: {
  regime: AnalysisRegime;
  buy: BuyTimeframes;
  sell: SellTimeframes;
  stochRsi: StochRsiAnalysis;
  priceTrend: PriceTrendAnalysis;
  adx: AdxAnalysis;
  atr: AtrAnalysis;
  liquidityConfirmation?: LiquidityConfirmation;
}): CompositeTimeframes => {
  const bullishRegime =
    regime === 'STRONG_BULLISH_LIQUIDITY' ||
    regime === 'EARLY_BULLISH' ||
    regime === 'CONFIRMED_BULLISH';
  const adxBullish = adx.bullishDirectionalBias;
  const highAtr = atr.volatilityRegime === 'HIGH';

  const shortTermScore = clampScore(
    (stochRsi.probableBuy ? 30 : 0) +
      (buy.shortTerm ? 25 : 0) +
      (priceTrend.bullish || priceTrend.direction === 'IMPROVING' ? 20 : 0) +
      (adxBullish ? 10 : 0) +
      (bullishRegime ? 10 : 0) -
      (stochRsi.confirmedSell
        ? 50
        : stochRsi.riskSell
          ? 35
          : 0) -
      (priceTrend.warning ? 20 : 0) -
      (highAtr ? 15 : 0) -
      (regime === 'SHORT_TERM_WARNING' ? 20 : 0) -
      (regime === 'BEARISH_LIQUIDITY' ? 35 : 0)
  );

  let shortTermAction: TimeframeAction = 'WAIT';
  let shortTermExplanationKey = 'timeframe.short.wait';

  if (stochRsi.confirmedSell && priceTrend.bearish) {
    shortTermAction = 'EXIT';
    shortTermExplanationKey = 'timeframe.short.exitConfirmedSell';
  } else if (stochRsi.confirmedSell) {
    shortTermAction = 'REDUCE';
    shortTermExplanationKey = 'timeframe.short.reduceConfirmedSell';
  } else if (stochRsi.riskSell || priceTrend.warning || highAtr) {
    shortTermAction = 'CAUTION';
    shortTermExplanationKey = 'timeframe.short.caution';
  } else if (
    shortTermScore >= 70 &&
    stochRsi.probableBuy &&
    buy.shortTerm &&
    priceTrend.bullish
  ) {
    shortTermAction = 'BUY';
    shortTermExplanationKey = 'timeframe.short.buyReady';
  } else if (shortTermScore >= 35 && stochRsi.probableBuy) {
    shortTermAction = 'PROBABLE_BUY';
    shortTermExplanationKey = 'timeframe.short.probableBuy';
  } else if (shortTermScore >= 20) {
    shortTermAction = 'HOLD';
    shortTermExplanationKey = 'timeframe.short.hold';
  }

  const midTermScore = clampScore(
    (buy.midTerm ? 30 : 0) +
      (priceTrend.bullish ? 25 : 0) +
      (bullishRegime ? 20 : 0) +
      (adxBullish ? 15 : 0) +
      (buy.longTerm ? 10 : 0) +
      (stochRsi.probableBuy ? 10 : 0) +
      (liquidityConfirmation?.liquidityExpansion ? 5 : 0) -
      (stochRsi.confirmedSell
        ? 40
        : stochRsi.riskSell
          ? 25
          : 0) -
      (priceTrend.bearish ? 25 : 0) -
      (regime === 'SHORT_TERM_WARNING' ? 20 : 0) -
      (regime === 'BEARISH_LIQUIDITY' ? 35 : 0) -
      (highAtr ? 10 : 0)
  );

  let midTermAction: TimeframeAction = 'WAIT';
  let midTermExplanationKey = 'timeframe.mid.wait';

  if (regime === 'BEARISH_LIQUIDITY' && priceTrend.bearish) {
    midTermAction = 'EXIT';
    midTermExplanationKey = 'timeframe.mid.exitBearish';
  } else if (stochRsi.confirmedSell && !buy.midTerm) {
    midTermAction = 'REDUCE';
    midTermExplanationKey = 'timeframe.mid.reduceConfirmedSell';
  } else if (
    stochRsi.riskSell ||
    priceTrend.warning ||
    regime === 'SHORT_TERM_WARNING'
  ) {
    midTermAction = 'CAUTION';
    midTermExplanationKey = 'timeframe.mid.caution';
  } else if (
    midTermScore >= 70 &&
    buy.midTerm &&
    priceTrend.bullish &&
    bullishRegime &&
    stochRsi.probableBuy
  ) {
    midTermAction = 'BUY';
    midTermExplanationKey = 'timeframe.mid.buyReady';
  } else if (
    midTermScore >= 35 &&
    (buy.midTerm || priceTrend.bullish) &&
    stochRsi.probableBuy
  ) {
    midTermAction = 'PROBABLE_BUY';
    midTermExplanationKey = 'timeframe.mid.probableBuy';
  } else if (midTermScore >= 20) {
    midTermAction = 'HOLD';
    midTermExplanationKey = 'timeframe.mid.hold';
  }

  const longTermScore = clampScore(
    (buy.longTerm ? 30 : 0) +
      (priceTrend.closeAboveLongMa ? 25 : 0) +
      (priceTrend.midAboveLongMa ? 20 : 0) +
      (bullishRegime ? 20 : 0) +
      (adxBullish ? 10 : 0) +
      (stochRsi.probableBuy ? 5 : 0) +
      (buy.midTerm ? 5 : 0) -
      (stochRsi.confirmedSell
        ? 25
        : stochRsi.riskSell
          ? 15
          : 0) -
      (priceTrend.bearish ? 35 : 0) -
      (regime === 'BEARISH_LIQUIDITY' ? 35 : 0) -
      (highAtr ? 10 : 0)
  );

  let longTermAction: TimeframeAction = 'WAIT';
  let longTermExplanationKey = 'timeframe.long.wait';

  if (regime === 'BEARISH_LIQUIDITY' && priceTrend.bearish && sell.longTerm) {
    longTermAction = 'EXIT';
    longTermExplanationKey = 'timeframe.long.exitBearish';
  } else if (priceTrend.bearish || sell.longTerm) {
    longTermAction = 'REDUCE';
    longTermExplanationKey = 'timeframe.long.reduce';
  } else if (stochRsi.confirmedSell || regime === 'SHORT_TERM_WARNING') {
    longTermAction = 'CAUTION';
    longTermExplanationKey = 'timeframe.long.caution';
  } else if (
    longTermScore >= 75 &&
    buy.longTerm &&
    priceTrend.bullish &&
    bullishRegime &&
    stochRsi.probableBuy
  ) {
    longTermAction = 'BUY';
    longTermExplanationKey = 'timeframe.long.buyReady';
  } else if (
    longTermScore >= 45 &&
    buy.longTerm &&
    priceTrend.bullish &&
    stochRsi.probableBuy
  ) {
    longTermAction = 'PROBABLE_BUY';
    longTermExplanationKey = 'timeframe.long.probableBuy';
  } else if (longTermScore >= 20) {
    longTermAction = 'HOLD';
    longTermExplanationKey = 'timeframe.long.hold';
  }

  return {
    shortTerm: buildTimeframeComposite(
      shortTermScore,
      shortTermAction,
      shortTermExplanationKey
    ),
    midTerm: buildTimeframeComposite(
      midTermScore,
      midTermAction,
      midTermExplanationKey
    ),
    longTerm: buildTimeframeComposite(
      longTermScore,
      longTermAction,
      longTermExplanationKey
    )
  };
};

const buildPresentationSignals = (
  regime: AnalysisRegime,
  confidence: AnalysisConfidence,
  buy: BuyTimeframes,
  sell: SellTimeframes,
  stochRsi: StochRsiAnalysis,
  priceTrend: PriceTrendAnalysis,
  adx: AdxAnalysis,
  atr: AtrAnalysis,
  composite: CompositeSignal,
  movingAverageAnalysis: MovingAverageAnalysis
): StockAnalysisSignals => {
  return {
    regime: labeledValue(
      regime,
      describeLabel('رژیم نقدینگی', regimeLabelMap[regime])
    ),
    crossWeeklyAboveMonthly: labeledBoolean(
      movingAverageAnalysis.crossWeeklyAboveMonthly,
      describeLabel('عبور میانگین هفتگی از ماهانه', 'تقاطع صعودی'),
      describeLabel('عبور میانگین هفتگی از ماهانه', 'بدون سیگنال')
    ),
    crossWeeklyBelowMonthly: labeledBoolean(
      movingAverageAnalysis.crossWeeklyBelowMonthly,
      describeLabel('عبور میانگین هفتگی زیر ماهانه', 'تقاطع نزولی'),
      describeLabel('عبور میانگین هفتگی زیر ماهانه', 'بدون سیگنال')
    ),
    crossMonthlyAboveQuarterly: labeledBoolean(
      movingAverageAnalysis.crossMonthlyAboveQuarterly,
      describeLabel('عبور میانگین ماهانه از فصلی', 'تقاطع صعودی'),
      describeLabel('عبور میانگین ماهانه از فصلی', 'بدون سیگنال')
    ),
    crossMonthlyBelowQuarterly: labeledBoolean(
      movingAverageAnalysis.crossMonthlyBelowQuarterly,
      describeLabel('عبور میانگین ماهانه زیر فصلی', 'تقاطع نزولی'),
      describeLabel('عبور میانگین ماهانه زیر فصلی', 'بدون سیگنال')
    ),
    confidence: labeledValue(
      confidence,
      describeLabel('سطح اطمینان تحلیل', confidenceLabelMap[confidence])
    ),
    buy: {
      shortTerm: labeledBoolean(
        buy.shortTerm,
        describeLabel('خرید کوتاه‌مدت', 'فعال'),
        describeLabel('خرید کوتاه‌مدت', 'غیرفعال')
      ),
      midTerm: labeledBoolean(
        buy.midTerm,
        describeLabel('خرید میان‌مدت', 'فعال'),
        describeLabel('خرید میان‌مدت', 'غیرفعال')
      ),
      longTerm: labeledBoolean(
        buy.longTerm,
        describeLabel('خرید بلندمدت', 'فعال'),
        describeLabel('خرید بلندمدت', 'غیرفعال')
      )
    },
    sell: {
      shortTerm: labeledBoolean(
        sell.shortTerm,
        describeLabel('فروش کوتاه‌مدت', 'فعال'),
        describeLabel('فروش کوتاه‌مدت', 'غیرفعال')
      ),
      midTerm: labeledBoolean(
        sell.midTerm,
        describeLabel('فروش میان‌مدت', 'فعال'),
        describeLabel('فروش میان‌مدت', 'غیرفعال')
      ),
      longTerm: labeledBoolean(
        sell.longTerm,
        describeLabel('فروش بلندمدت', 'فعال'),
        describeLabel('فروش بلندمدت', 'غیرفعال')
      )
    },
    stochRsi: {
      ...stochRsi,
      status: labeledValue(
        stochRsi.status,
        describeLabel(
          'وضعیت محاسبه Stoch RSI',
          stochRsiStatusLabelMap[stochRsi.status]
        )
      ),
      latestZone: labeledValue(
        stochRsi.latestZone,
        describeLabel('ناحیه فعلی Stoch RSI', stochRsiZoneLabelMap[stochRsi.latestZone])
      ),
      crossUpInGreen: labeledBoolean(
        stochRsi.crossUpInGreen,
        describeLabel('تقاطع صعودی در ناحیه سبز', 'فعال'),
        describeLabel('تقاطع صعودی در ناحیه سبز', 'بدون سیگنال')
      ),
      crossDownInRed: labeledBoolean(
        stochRsi.crossDownInRed,
        describeLabel('تقاطع نزولی در ناحیه قرمز', 'فعال'),
        describeLabel('تقاطع نزولی در ناحیه قرمز', 'بدون سیگنال')
      ),
      probableBuy: labeledBoolean(
        stochRsi.probableBuy,
        describeLabel('آمادگی خرید Stoch RSI', 'فعال'),
        describeLabel('آمادگی خرید Stoch RSI', 'غیرفعال')
      ),
      riskSell: labeledBoolean(
        stochRsi.riskSell,
        describeLabel('ریسک فروش Stoch RSI', 'فعال'),
        describeLabel('ریسک فروش Stoch RSI', 'غیرفعال')
      ),
      confirmedSell: labeledBoolean(
        stochRsi.confirmedSell,
        describeLabel('فروش تاییدشده Stoch RSI', 'فعال'),
        describeLabel('فروش تاییدشده Stoch RSI', 'غیرفعال')
      )
    },
    priceTrend: {
      ...priceTrend,
      status: labeledValue(
        priceTrend.status,
        describeLabel(
          'وضعیت محاسبه روند قیمت',
          priceTrendStatusLabelMap[priceTrend.status]
        )
      ),
      direction: labeledValue(
        priceTrend.direction,
        describeLabel(
          'جهت روند قیمت',
          priceTrendDirectionLabelMap[priceTrend.direction]
        )
      ),
      closeAboveFastMa: labeledBoolean(
        priceTrend.closeAboveFastMa,
        describeLabel('قیمت نسبت به میانگین سریع', 'بالاتر'),
        describeLabel('قیمت نسبت به میانگین سریع', 'پایین‌تر')
      ),
      closeAboveMidMa: labeledBoolean(
        priceTrend.closeAboveMidMa,
        describeLabel('قیمت نسبت به میانگین میانی', 'بالاتر'),
        describeLabel('قیمت نسبت به میانگین میانی', 'پایین‌تر')
      ),
      closeAboveLongMa: labeledBoolean(
        priceTrend.closeAboveLongMa,
        describeLabel('قیمت نسبت به میانگین بلند', 'بالاتر'),
        describeLabel('قیمت نسبت به میانگین بلند', 'پایین‌تر')
      ),
      fastAboveMidMa: labeledBoolean(
        priceTrend.fastAboveMidMa,
        describeLabel('میانگین سریع نسبت به میانی', 'بالاتر'),
        describeLabel('میانگین سریع نسبت به میانی', 'پایین‌تر')
      ),
      midAboveLongMa: labeledBoolean(
        priceTrend.midAboveLongMa,
        describeLabel('میانگین میانی نسبت به بلند', 'بالاتر'),
        describeLabel('میانگین میانی نسبت به بلند', 'پایین‌تر')
      ),
      bullish: labeledBoolean(
        priceTrend.bullish,
        describeLabel('سیگنال صعودی روند قیمت', 'فعال'),
        describeLabel('سیگنال صعودی روند قیمت', 'غیرفعال')
      ),
      bearish: labeledBoolean(
        priceTrend.bearish,
        describeLabel('سیگنال نزولی روند قیمت', 'فعال'),
        describeLabel('سیگنال نزولی روند قیمت', 'غیرفعال')
      ),
      warning: labeledBoolean(
        priceTrend.warning,
        describeLabel('هشدار روند قیمت', 'فعال'),
        describeLabel('هشدار روند قیمت', 'عادی')
      )
    },
    adx: {
      ...adx,
      status: labeledValue(
        adx.status,
        describeLabel('وضعیت محاسبه ADX', adxStatusLabelMap[adx.status])
      ),
      trendStrength: labeledValue(
        adx.trendStrength,
        describeLabel('قدرت روند ADX', adxTrendStrengthLabelMap[adx.trendStrength])
      ),
      directionalBias: getAdxDirectionalBias(adx),
      bullishDirectionalBias: labeledBoolean(
        adx.bullishDirectionalBias,
        describeLabel('غلبه صعودی ADX', 'فعال'),
        describeLabel('غلبه صعودی ADX', 'غیرفعال')
      ),
      bearishDirectionalBias: labeledBoolean(
        adx.bearishDirectionalBias,
        describeLabel('غلبه نزولی ADX', 'فعال'),
        describeLabel('غلبه نزولی ADX', 'غیرفعال')
      )
    },
    atr: {
      ...atr,
      status: labeledValue(
        atr.status,
        describeLabel('وضعیت محاسبه ATR', atrStatusLabelMap[atr.status])
      ),
      volatilityRegime: labeledValue(
        atr.volatilityRegime,
        describeLabel(
          'وضعیت نوسان ATR',
          atrVolatilityLabelMap[atr.volatilityRegime]
        )
      )
    },
    composite: {
      ...composite,
      action: labeledValue(
        composite.action,
        describeLabel('اقدام نهایی تحلیل', compositeActionLabelMap[composite.action])
      ),
      bias: labeledValue(
        composite.bias,
        describeLabel('سوگیری کلی تحلیل', compositeBiasLabelMap[composite.bias])
      ),
      entryTiming: labeledValue(
        composite.entryTiming,
        describeLabel(
          'وضعیت زمان‌بندی ورود',
          compositeEntryTimingLabelMap[composite.entryTiming]
        )
      ),
      timeframes: {
        shortTerm: {
          ...composite.timeframes.shortTerm,
          action: labeledValue(
            composite.timeframes.shortTerm.action,
            describeLabel(
              'اقدام کوتاه‌مدت',
              timeframeActionLabelMap[composite.timeframes.shortTerm.action]
            )
          ),
          quality: labeledValue(
            composite.timeframes.shortTerm.quality,
            describeLabel(
              'کیفیت کوتاه‌مدت',
              timeframeQualityLabelMap[composite.timeframes.shortTerm.quality]
            )
          )
        },
        midTerm: {
          ...composite.timeframes.midTerm,
          action: labeledValue(
            composite.timeframes.midTerm.action,
            describeLabel(
              'اقدام میان‌مدت',
              timeframeActionLabelMap[composite.timeframes.midTerm.action]
            )
          ),
          quality: labeledValue(
            composite.timeframes.midTerm.quality,
            describeLabel(
              'کیفیت میان‌مدت',
              timeframeQualityLabelMap[composite.timeframes.midTerm.quality]
            )
          )
        },
        longTerm: {
          ...composite.timeframes.longTerm,
          action: labeledValue(
            composite.timeframes.longTerm.action,
            describeLabel(
              'اقدام بلندمدت',
              timeframeActionLabelMap[composite.timeframes.longTerm.action]
            )
          ),
          quality: labeledValue(
            composite.timeframes.longTerm.quality,
            describeLabel(
              'کیفیت بلندمدت',
              timeframeQualityLabelMap[composite.timeframes.longTerm.quality]
            )
          )
        }
      }
    }
  };
};

export const calculateCompositeSignal = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  sell: SellTimeframes,
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
  const timeframes = calculateTimeframeComposites({
    regime,
    buy,
    sell,
    stochRsi,
    priceTrend,
    adx:
      adx ??
      ({
        status: 'INSUFFICIENT_DATA',
        period: 14,
        latestAdx: null,
        latestPlusDi: null,
        latestMinusDi: null,
        trendStrength: 'INSUFFICIENT_DATA',
        bullishDirectionalBias: false,
        bearishDirectionalBias: false
      } satisfies AdxAnalysis),
    atr:
      atr ??
      ({
        status: 'INSUFFICIENT_DATA',
        period: 14,
        latestAtr: null,
        latestAtrPercent: null,
        volatilityRegime: 'INSUFFICIENT_DATA'
      } satisfies AtrAnalysis),
    ...(liquidityConfirmation ? { liquidityConfirmation } : {})
  });

  return {
    action,
    score,
    bias: classifyBias(score),
    entryTiming: classifyEntryTiming(action),
    explanationKey,
    scoreScale: {
      min: -100,
      max: 100
    },
    timeframes
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
    sell,
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
    signals: buildPresentationSignals(
      regime,
      confidence,
      buy,
      sell,
      stochRsi,
      priceTrend,
      adx,
      atr,
      composite,
      movingAverageAnalysis
    ),
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
