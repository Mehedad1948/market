import type { SymbolDailyMetric } from '@prisma/client';

import { env } from '../config/env';
import type {
  AnalysisScoringOverrides,
  AnalysisIndicatorComponent,
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
  LiquidityTrendIntegrity,
  LiquidityMetrics,
  LabeledValue,
  MfiAnalysis,
  MovingAverageAnalysis,
  PriceTrendAnalysis,
  PriceTrendConfig,
  TrendResilienceAnalysis,
  SellTimeframes,
  StockAnalysisSignals,
  StochRsiAnalysis,
  StochRsiConfig,
  StockAnalysisResult,
  SymbolAnalysisParams,
  IndicatorMode,
  ExistingPositionAdvice,
  NewPositionAdvice,
  TimeframeAction,
  TimeframeComposite,
  TimeframeDecision,
  TimeframePositionAdvice,
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
  calculateAtrAnalysis,
  calculateMfiAnalysis
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
  threshold = 0.02,
  liquidityTrendIntegrity?: LiquidityTrendIntegrity
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
    shortTerm: false,
    midTerm:
      (liquidityTrendIntegrity === undefined ||
        liquidityTrendIntegrity.status !== 'INVALIDATED') &&
      isAboveBy(maMonthly, maQuarterly, threshold) &&
      monthlySlope > 0 &&
      latestTradeValue > maMonthly &&
      (liquidityTrendIntegrity?.canFollowBullishTrend ?? true),
    longTerm:
      (liquidityTrendIntegrity === undefined ||
        liquidityTrendIntegrity.status === 'INTACT') &&
      quarterlySlope > 0 &&
      maMonthly > maQuarterly &&
      latestTradeValue > maQuarterly &&
      (liquidityTrendIntegrity?.canFollowBullishTrend ?? true)
  };
};

const calculateLiquidityTrendIntegrity = (
  metrics: LiquidityMetrics,
  movingAverageAnalysis: MovingAverageAnalysis,
  liquidityConfirmation?: LiquidityConfirmation
): LiquidityTrendIntegrity => {
  const weeklyAboveMonthly = metrics.maWeekly > metrics.maMonthly;
  const monthlyAboveQuarterly = metrics.maMonthly > metrics.maQuarterly;
  const latestAboveWeeklyMa = metrics.latestTradeValue > metrics.maWeekly;
  const latestAboveMonthlyMa = metrics.latestTradeValue > metrics.maMonthly;
  const latestAboveQuarterlyMa = metrics.latestTradeValue > metrics.maQuarterly;
  const weeklySlopePositive = metrics.weeklySlope > 0;
  const monthlySlopePositive = metrics.monthlySlope > 0;
  const quarterlySlopeNonNegative = metrics.quarterlySlope >= 0;
  const recentBearishWeeklyCross = movingAverageAnalysis.crossWeeklyBelowMonthly;
  const recentBearishMonthlyCross =
    movingAverageAnalysis.crossMonthlyBelowQuarterly;
  const structuralBullish =
    weeklyAboveMonthly && monthlyAboveQuarterly && monthlySlopePositive;
  const structuralSupportive =
    monthlyAboveQuarterly && monthlySlopePositive && quarterlySlopeNonNegative;
  const invalidated =
    recentBearishMonthlyCross ||
    !monthlyAboveQuarterly ||
    (!latestAboveQuarterlyMa && !quarterlySlopeNonNegative) ||
    (!latestAboveMonthlyMa && !monthlySlopePositive);
  const intact =
    structuralBullish &&
    latestAboveMonthlyMa &&
    latestAboveQuarterlyMa &&
    !recentBearishWeeklyCross &&
    !recentBearishMonthlyCross &&
    !(liquidityConfirmation?.liquidityContraction ?? false);
  const weakening =
    !intact &&
    !invalidated &&
    (structuralSupportive || latestAboveQuarterlyMa);

  return {
    status: intact ? 'INTACT' : weakening ? 'WEAKENING' : 'INVALIDATED',
    weeklyAboveMonthly,
    monthlyAboveQuarterly,
    latestAboveWeeklyMa,
    latestAboveMonthlyMa,
    latestAboveQuarterlyMa,
    weeklySlopePositive,
    monthlySlopePositive,
    quarterlySlopeNonNegative,
    recentBearishWeeklyCross,
    recentBearishMonthlyCross,
    canFollowBullishTrend: intact || weakening,
    canUsePullbacks:
      intact ||
      (weakening &&
        structuralSupportive &&
        latestAboveQuarterlyMa &&
        !recentBearishMonthlyCross)
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
const TREND_RESILIENCE_MID_BUFFER = 0.01;
const TREND_RESILIENCE_LONG_BUFFER = 0.03;
const MFI_PERIOD = 14;
const MFI_LOWER_THRESHOLD = 20;
const MFI_UPPER_THRESHOLD = 80;

const calculateTrendResilience = (
  priceTrend: PriceTrendAnalysis
): TrendResilienceAnalysis => {
  if (
    priceTrend.status !== 'OK' ||
    priceTrend.latestClosePrice === null ||
    priceTrend.midMa === null ||
    priceTrend.longMa === null ||
    priceTrend.fastSlope === null ||
    priceTrend.midSlope === null ||
    priceTrend.longSlope === null
  ) {
    return {
      status: 'INSUFFICIENT_DATA',
      closeVsMidPercent: null,
      closeVsLongPercent: null,
      resilient: false,
      strongResilient: false,
      fragile: false
    };
  }

  const closeVsMidPercent =
    priceTrend.midMa !== 0
      ? round((priceTrend.latestClosePrice - priceTrend.midMa) / priceTrend.midMa)
      : null;
  const closeVsLongPercent =
    priceTrend.longMa !== 0
      ? round((priceTrend.latestClosePrice - priceTrend.longMa) / priceTrend.longMa)
      : null;
  const resilient =
    priceTrend.closeAboveMidMa &&
    priceTrend.closeAboveLongMa &&
    priceTrend.midAboveLongMa &&
    priceTrend.midSlope > 0 &&
    priceTrend.longSlope >= 0;
  const strongResilient =
    resilient &&
    priceTrend.fastAboveMidMa &&
    priceTrend.fastSlope > 0 &&
    (closeVsMidPercent ?? -Infinity) >= TREND_RESILIENCE_MID_BUFFER &&
    (closeVsLongPercent ?? -Infinity) >= TREND_RESILIENCE_LONG_BUFFER;
  const fragile =
    !priceTrend.closeAboveMidMa ||
    !priceTrend.midAboveLongMa ||
    (priceTrend.fastSlope < 0 && priceTrend.midSlope <= 0);

  return {
    status: 'OK',
    closeVsMidPercent,
    closeVsLongPercent,
    resilient,
    strongResilient,
    fragile
  };
};

const analysisIndicatorComponents = [
  'liquidity',
  'stochRsi',
  'priceTrend',
  'mfi',
  'adx',
  'atr'
] as const satisfies readonly AnalysisIndicatorComponent[];

const defaultScoringOverrides = {
  liquidityWeight: 1,
  stochRsiWeight: 1,
  priceTrendWeight: 1,
  mfiWeight: 1,
  adxWeight: 1,
  atrPenaltyWeight: 1,
  trendResilienceWeight: 1
} as const satisfies Required<AnalysisScoringOverrides>;

const resolveScoringOverrides = (
  overrides?: AnalysisScoringOverrides
): Required<AnalysisScoringOverrides> => ({
  ...defaultScoringOverrides,
  ...(overrides ?? {})
});

type AnalysisComponentState = Record<AnalysisIndicatorComponent, boolean>;

const buildAnalysisComponentState = (
  params: Pick<SymbolAnalysisParams, 'indicatorMode' | 'disabledIndicators'>
): AnalysisComponentState => {
  const mode = params.indicatorMode ?? 'composite';
  const disabled = new Set(params.disabledIndicators ?? []);
  const baseState: AnalysisComponentState = {
    liquidity: true,
    stochRsi: true,
    priceTrend: true,
    mfi: true,
    adx: true,
    atr: true
  };

  if (mode === 'liquidity_only') {
    return {
      liquidity: !disabled.has('liquidity'),
      stochRsi: false,
      priceTrend: false,
      mfi: false,
      adx: false,
      atr: false
    };
  }

  if (mode === 'stochRsi_only') {
    return {
      liquidity: false,
      stochRsi: !disabled.has('stochRsi'),
      priceTrend: false,
      mfi: false,
      adx: false,
      atr: false
    };
  }

  if (mode === 'priceTrend_only') {
    return {
      liquidity: false,
      stochRsi: false,
      priceTrend: !disabled.has('priceTrend'),
      mfi: false,
      adx: false,
      atr: false
    };
  }

  if (mode === 'mfi_only') {
    return {
      liquidity: false,
      stochRsi: false,
      priceTrend: false,
      mfi: !disabled.has('mfi'),
      adx: false,
      atr: false
    };
  }

  for (const component of analysisIndicatorComponents) {
    if (disabled.has(component)) {
      baseState[component] = false;
    }
  }

  return baseState;
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
    mfi: {
      period: MFI_PERIOD,
      lowerThreshold: MFI_LOWER_THRESHOLD,
      upperThreshold: MFI_UPPER_THRESHOLD
    },
    stochRsi: getStochRsiConfig(),
    priceTrend: getPriceTrendConfig()
  };
};

export const buildAnalysisParamsHash = (
  params: Pick<
    SymbolAnalysisParams,
    | 'weeklyWindow'
    | 'monthlyWindow'
    | 'quarterlyWindow'
    | 'includeRealLegal'
    | 'indicatorMode'
    | 'disabledIndicators'
    | 'scoringOverrides'
  >
) => {
  return createHash({
    weeklyWindow: params.weeklyWindow,
    monthlyWindow: params.monthlyWindow,
    quarterlyWindow: params.quarterlyWindow,
    includeRealLegal: params.includeRealLegal,
    indicatorMode: params.indicatorMode ?? 'composite',
    disabledIndicators: [...(params.disabledIndicators ?? [])].sort(),
    scoringOverrides: resolveScoringOverrides(params.scoringOverrides),
    analysisConfig: buildAnalysisConfigForCache(),
    cacheSignature: ANALYSIS_CACHE_SIGNATURE
  });
};

export const calculateSellTimeframes = (
  regime: AnalysisRegime,
  buy: BuyTimeframes,
  stochRsi: StochRsiAnalysis,
  priceTrend: PriceTrendAnalysis,
  liquidityTrendIntegrity?: LiquidityTrendIntegrity
): SellTimeframes => {
  return {
    shortTerm: false,
    midTerm:
      liquidityTrendIntegrity?.status === 'INVALIDATED' ||
      (stochRsi.confirmedSell &&
        (!buy.midTerm ||
          priceTrend.bearish ||
          regime === 'BEARISH_LIQUIDITY')),
    longTerm:
      liquidityTrendIntegrity?.status === 'INVALIDATED' ||
      (regime === 'BEARISH_LIQUIDITY' &&
        stochRsi.confirmedSell &&
        priceTrend.bearish)
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

const newPositionAdviceLabelMap: Record<NewPositionAdvice, string> = {
  BUY: 'برای ورود جدید: خرید',
  PROBABLE_BUY: 'برای ورود جدید: خرید احتمالی',
  WAIT: 'برای ورود جدید: صبر',
  WAIT_FOR_ENTRY_TRIGGER: 'برای ورود جدید: صبر تا فعال شدن تریگر ورود',
  AVOID: 'برای ورود جدید: عدم ورود'
};

const existingPositionAdviceLabelMap: Record<ExistingPositionAdvice, string> = {
  HOLD: 'برای دارنده سهم: نگهداری',
  HOLD_WITH_CAUTION: 'برای دارنده سهم: نگهداری با احتیاط',
  REDUCE: 'برای دارنده سهم: کاهش ریسک / کاهش حجم',
  EXIT: 'برای دارنده سهم: خروج',
  MONITOR: 'برای دارنده سهم: نظارت'
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

const mfiStatusLabelMap: Record<MfiAnalysis['status'], string> = {
  OK: 'Ready',
  INSUFFICIENT_DATA: 'Insufficient data'
};

const mfiDirectionLabelMap: Record<MfiAnalysis['direction'], string> = {
  RISING: 'Rising',
  FALLING: 'Falling',
  FLAT: 'Flat',
  INSUFFICIENT_DATA: 'Insufficient data'
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

const buildTimeframeDecision = (
  action: TimeframeAction
): TimeframeDecision => {
  return {
    buy: action === 'BUY' || action === 'PROBABLE_BUY',
    sell: action === 'REDUCE' || action === 'EXIT',
    hold: action === 'HOLD',
    wait: action === 'WAIT',
    caution: action === 'CAUTION',
    reduce: action === 'REDUCE',
    exit: action === 'EXIT'
  };
};

const buildTimeframePositionAdvice = (
  action: TimeframeAction,
  quality: TimeframeQuality
): TimeframePositionAdvice => {
  if (action === 'BUY') {
    return {
      forNewPosition: 'BUY',
      forExistingPosition: 'HOLD'
    };
  }

  if (action === 'PROBABLE_BUY') {
    return {
      forNewPosition: 'PROBABLE_BUY',
      forExistingPosition: 'HOLD'
    };
  }

  if (action === 'HOLD') {
    return {
      forNewPosition:
        quality === 'STRONG_BULLISH' || quality === 'BULLISH'
          ? 'WAIT_FOR_ENTRY_TRIGGER'
          : 'WAIT',
      forExistingPosition: 'HOLD'
    };
  }

  if (action === 'WAIT') {
    return {
      forNewPosition: 'WAIT',
      forExistingPosition:
        quality === 'STRONG_BULLISH' || quality === 'BULLISH'
          ? 'MONITOR'
          : 'HOLD_WITH_CAUTION'
    };
  }

  if (action === 'CAUTION') {
    return {
      forNewPosition: 'AVOID',
      forExistingPosition: 'HOLD_WITH_CAUTION'
    };
  }

  if (action === 'REDUCE') {
    return {
      forNewPosition: 'AVOID',
      forExistingPosition: 'REDUCE'
    };
  }

  if (action === 'EXIT') {
    return {
      forNewPosition: 'AVOID',
      forExistingPosition: 'EXIT'
    };
  }

  return {
    forNewPosition: 'WAIT',
    forExistingPosition: 'MONITOR'
  };
};

const buildTimeframeComposite = (
  score: number,
  action: TimeframeAction,
  explanationKey: string
): TimeframeComposite => {
  const normalizedScore = clampScore(score);
  const quality = classifyTimeframeQuality(normalizedScore);

  return {
    score: normalizedScore,
    action,
    quality,
    decision: buildTimeframeDecision(action),
    positionAdvice: buildTimeframePositionAdvice(action, quality),
    explanationKey
  };
};

type CoreSignalInputs = {
  regime: AnalysisRegime;
  buy: BuyTimeframes;
  stochRsi: StochRsiAnalysis;
  priceTrend: PriceTrendAnalysis;
  trendResilience: TrendResilienceAnalysis;
  liquidityTrendIntegrity: LiquidityTrendIntegrity;
  mfi: MfiAnalysis;
  components: AnalysisComponentState;
};

const getCoreSignalVotes = ({
  regime,
  buy,
  stochRsi,
  priceTrend,
  trendResilience,
  liquidityTrendIntegrity,
  mfi,
  components
}: CoreSignalInputs) => {
  const bullishRegime =
    regime === 'STRONG_BULLISH_LIQUIDITY' ||
    regime === 'EARLY_BULLISH' ||
    regime === 'CONFIRMED_BULLISH';
  const bearishLiquidity = regime === 'BEARISH_LIQUIDITY';
  const stochWarning =
    stochRsi.crossDownInRed && !stochRsi.riskSell && !stochRsi.confirmedSell;

  const votes = {
    liquidity: components.liquidity
      ? {
          bullish:
            liquidityTrendIntegrity.canFollowBullishTrend ||
            bullishRegime ||
            buy.midTerm ||
            buy.longTerm,
          strong:
            liquidityTrendIntegrity.status === 'INTACT' &&
            buy.midTerm &&
            buy.longTerm &&
            regime !== 'BEARISH_LIQUIDITY',
          bearish:
            bearishLiquidity ||
            liquidityTrendIntegrity.status === 'INVALIDATED'
        }
      : null,
    stochRsi: components.stochRsi
      ? {
          bullish: stochRsi.probableBuy,
          strong: stochRsi.probableBuy && !stochRsi.riskSell && !stochRsi.confirmedSell,
          bearish: stochRsi.riskSell || stochRsi.confirmedSell
        }
      : null,
    priceTrend: components.priceTrend
      ? {
          bullish:
            priceTrend.bullish || priceTrend.direction === 'IMPROVING',
          strong: priceTrend.bullish,
          bearish: priceTrend.bearish || priceTrend.warning
        }
      : null,
    mfi: components.mfi
      ? {
          bullish: mfi.bullishConfirmation || mfi.accumulation,
          strong: mfi.accumulation,
          bearish: mfi.bearishConfirmation || mfi.distribution
        }
      : null,
    trendResilience:
      components.priceTrend && trendResilience.status === 'OK'
        ? {
            bullish: trendResilience.resilient,
            strong: trendResilience.strongResilient,
            bearish: trendResilience.fragile
          }
      : null
  };

  const coreComponents = Object.entries(votes).filter(([, value]) => value !== null);
  const enabledCount = coreComponents.length;
  const bullishCount = coreComponents.filter(([, value]) => value?.bullish).length;
  const strongCount = coreComponents.filter(([, value]) => value?.strong).length;
  const bearishCount = coreComponents.filter(([, value]) => value?.bearish).length;

  return {
    votes,
    enabledCount,
    bullishCount,
    strongCount,
    bearishCount,
    bullishRegime
  };
};

const calculateTimeframeComposites = ({
  regime,
  buy,
  sell,
  stochRsi,
  priceTrend,
  trendResilience,
  liquidityTrendIntegrity,
  mfi,
  adx,
  atr,
  liquidityConfirmation,
  components,
  scoringOverrides
}: {
  regime: AnalysisRegime;
  buy: BuyTimeframes;
  sell: SellTimeframes;
  stochRsi: StochRsiAnalysis;
  priceTrend: PriceTrendAnalysis;
  trendResilience: TrendResilienceAnalysis;
  liquidityTrendIntegrity: LiquidityTrendIntegrity;
  mfi: MfiAnalysis;
  adx: AdxAnalysis;
  atr: AtrAnalysis;
  liquidityConfirmation?: LiquidityConfirmation;
  components: AnalysisComponentState;
  scoringOverrides?: AnalysisScoringOverrides;
}): CompositeTimeframes => {
  const weights = resolveScoringOverrides(scoringOverrides);
  const { enabledCount, bullishCount, strongCount, bearishCount, bullishRegime } =
    getCoreSignalVotes({
      regime,
      buy,
      stochRsi,
      priceTrend,
      trendResilience,
      liquidityTrendIntegrity,
      mfi,
      components
    });
  const usingFullComposite =
    components.liquidity && components.stochRsi && components.priceTrend;
  const stochWarning =
    components.stochRsi &&
    stochRsi.crossDownInRed &&
    !stochRsi.riskSell &&
    !stochRsi.confirmedSell;
  const resilientTrend =
    components.priceTrend && trendResilience.status === 'OK' && trendResilience.resilient;
  const strongResilientTrend =
    components.priceTrend &&
    trendResilience.status === 'OK' &&
    trendResilience.strongResilient;
  const mfiBullish = components.mfi && (mfi.bullishConfirmation || mfi.accumulation);
  const mfiBearish = components.mfi && (mfi.bearishConfirmation || mfi.distribution);
  const liquidityTrendIntact = liquidityTrendIntegrity.status === 'INTACT';
  const liquidityTrendWeakening = liquidityTrendIntegrity.status === 'WEAKENING';
  const liquidityTrendInvalidated =
    liquidityTrendIntegrity.status === 'INVALIDATED';
  const trendDeteriorating =
    components.priceTrend &&
    priceTrend.bearish &&
    !resilientTrend;
  const severeTrendDeterioration =
    trendDeteriorating &&
    (!components.liquidity || liquidityTrendInvalidated || !buy.midTerm);
  const adxBullish = components.adx && adx.bullishDirectionalBias;
  const adxBearish = components.adx && adx.bearishDirectionalBias;
  const highAtr = components.atr && atr.volatilityRegime === 'HIGH';
  const coreBullishWeight = bullishCount * 30 + strongCount * 15;
  const coreBearishWeight = bearishCount * 25;

  const midTermScore = clampScore(
    (components.liquidity && buy.midTerm ? 30 * weights.liquidityWeight : 0) +
      (components.priceTrend && priceTrend.bullish
        ? 25 * weights.priceTrendWeight
        : 0) +
      (components.priceTrend && priceTrend.direction === 'IMPROVING'
        ? 10 * weights.priceTrendWeight
        : 0) +
      (components.liquidity && bullishRegime ? 20 * weights.liquidityWeight : 0) +
      (components.liquidity && liquidityTrendIntact
        ? 10 * weights.liquidityWeight
        : 0) +
      (components.liquidity && liquidityTrendWeakening
        ? 4 * weights.liquidityWeight
        : 0) +
      (mfiBullish ? 8 * weights.mfiWeight : 0) +
      (adxBullish ? 15 * weights.adxWeight : 0) +
      (components.liquidity && buy.longTerm ? 10 * weights.liquidityWeight : 0) +
      (components.stochRsi && stochRsi.probableBuy
        ? 10 * weights.stochRsiWeight
        : 0) +
      (strongResilientTrend
        ? 12 * weights.trendResilienceWeight
        : resilientTrend
          ? 6 * weights.trendResilienceWeight
          : 0) +
      (components.liquidity && liquidityConfirmation?.liquidityExpansion
        ? 5 * weights.liquidityWeight
        : 0) -
      (components.stochRsi
        ? stochRsi.confirmedSell
        ? 20 * weights.stochRsiWeight
        : stochRsi.riskSell
          ? 10 * weights.stochRsiWeight
          : stochWarning
            ? strongResilientTrend
              ? 1 * weights.stochRsiWeight
              : 4 * weights.stochRsiWeight
          : 0
        : 0) -
      (components.priceTrend && priceTrend.bearish
        ? 25 * weights.priceTrendWeight
        : 0) -
      (components.liquidity && regime === 'BEARISH_LIQUIDITY'
        ? 35 * weights.liquidityWeight
        : 0) -
      (components.liquidity && liquidityTrendInvalidated
        ? 20 * weights.liquidityWeight
        : 0) -
      (mfiBearish ? 10 * weights.mfiWeight : 0) -
      (highAtr ? 5 * weights.atrPenaltyWeight : 0)
  );

  let midTermAction: TimeframeAction = 'WAIT';
  let midTermExplanationKey = 'timeframe.mid.wait';

  if (
    components.liquidity &&
    liquidityTrendInvalidated &&
    (!components.priceTrend || priceTrend.bearish || !buy.midTerm)
  ) {
    midTermAction = 'EXIT';
    midTermExplanationKey = 'timeframe.mid.exitBearish';
  } else if (components.stochRsi && stochRsi.confirmedSell && !buy.midTerm) {
    midTermAction = 'REDUCE';
    midTermExplanationKey = 'timeframe.mid.reduceConfirmedSell';
  } else if (
    (components.stochRsi && stochRsi.confirmedSell && !buy.longTerm) ||
    (components.liquidity && liquidityTrendInvalidated && !buy.midTerm) ||
    (components.stochRsi &&
      stochRsi.riskSell &&
      (liquidityTrendInvalidated || severeTrendDeterioration))
  ) {
    midTermAction = 'CAUTION';
    midTermExplanationKey = 'timeframe.mid.caution';
  } else if (
    usingFullComposite
      ? midTermScore >= 70 &&
        buy.midTerm &&
        priceTrend.bullish &&
        bullishRegime &&
        stochRsi.probableBuy
      : midTermScore >= 70 &&
        bullishCount > 0 &&
        strongCount >= Math.max(1, enabledCount - 1)
  ) {
    midTermAction = 'BUY';
    midTermExplanationKey = 'timeframe.mid.buyReady';
  } else if (
    usingFullComposite
      ? midTermScore >= 35 &&
        (buy.midTerm || priceTrend.bullish) &&
        stochRsi.probableBuy
      : midTermScore >= 35 &&
        bullishCount > 0 &&
        bearishCount === 0
  ) {
    midTermAction = 'PROBABLE_BUY';
    midTermExplanationKey = 'timeframe.mid.probableBuy';
  } else if (midTermScore >= 20) {
    midTermAction = 'HOLD';
    midTermExplanationKey = liquidityTrendIntact
      ? 'timeframe.mid.holdTrendIntact'
      : liquidityTrendWeakening
        ? 'timeframe.mid.holdPullback'
        : 'timeframe.mid.hold';
  }

  if (
    midTermAction === 'CAUTION' &&
    liquidityTrendIntegrity.canUsePullbacks &&
    !stochRsi.confirmedSell &&
    !liquidityTrendInvalidated &&
    !severeTrendDeterioration
  ) {
    midTermAction = 'HOLD';
    midTermExplanationKey = 'timeframe.mid.holdPullback';
  }

  const longTermScore = clampScore(
    (components.liquidity && buy.longTerm ? 30 * weights.liquidityWeight : 0) +
      (components.priceTrend && priceTrend.closeAboveLongMa
        ? 25 * weights.priceTrendWeight
        : 0) +
      (components.priceTrend && priceTrend.midAboveLongMa
        ? 20 * weights.priceTrendWeight
        : 0) +
      (components.liquidity && bullishRegime ? 20 * weights.liquidityWeight : 0) +
      (components.liquidity && liquidityTrendIntact
        ? 12 * weights.liquidityWeight
        : 0) +
      (components.liquidity && liquidityTrendWeakening
        ? 5 * weights.liquidityWeight
        : 0) +
      (mfiBullish ? 6 * weights.mfiWeight : 0) +
      (adxBullish ? 10 * weights.adxWeight : 0) +
      (components.stochRsi && stochRsi.probableBuy
        ? 5 * weights.stochRsiWeight
        : 0) +
      (components.liquidity && buy.midTerm ? 5 * weights.liquidityWeight : 0) +
      (strongResilientTrend
        ? 15 * weights.trendResilienceWeight
        : resilientTrend
          ? 8 * weights.trendResilienceWeight
          : 0) -
      (components.stochRsi
        ? stochRsi.confirmedSell
        ? 10 * weights.stochRsiWeight
        : stochRsi.riskSell
          ? 5 * weights.stochRsiWeight
          : stochWarning
            ? strongResilientTrend
              ? 0
              : 2 * weights.stochRsiWeight
          : 0
        : 0) -
      (components.priceTrend && priceTrend.bearish
        ? 35 * weights.priceTrendWeight
        : 0) -
      (components.liquidity && regime === 'BEARISH_LIQUIDITY'
        ? 35 * weights.liquidityWeight
        : 0) -
      (components.liquidity && liquidityTrendInvalidated
        ? 25 * weights.liquidityWeight
        : 0) -
      (mfiBearish ? 8 * weights.mfiWeight : 0) -
      (highAtr ? 5 * weights.atrPenaltyWeight : 0)
  );

  let longTermAction: TimeframeAction = 'WAIT';
  let longTermExplanationKey = 'timeframe.long.wait';

  if (
    components.liquidity &&
    liquidityTrendInvalidated &&
    (!components.priceTrend || priceTrend.bearish) &&
    sell.longTerm
  ) {
    longTermAction = 'EXIT';
    longTermExplanationKey = 'timeframe.long.exitBearish';
  } else if (liquidityTrendInvalidated || severeTrendDeterioration || sell.longTerm) {
    longTermAction = 'REDUCE';
    longTermExplanationKey = 'timeframe.long.reduce';
  } else if (
    (components.stochRsi && stochRsi.confirmedSell) ||
    (components.stochRsi &&
      stochRsi.riskSell &&
      (liquidityTrendInvalidated || severeTrendDeterioration))
  ) {
    longTermAction = 'CAUTION';
    longTermExplanationKey = 'timeframe.long.caution';
  } else if (
    usingFullComposite
      ? longTermScore >= 75 &&
        buy.longTerm &&
        priceTrend.bullish &&
        bullishRegime &&
        stochRsi.probableBuy
      : longTermScore >= 75 &&
        strongCount >= Math.max(1, enabledCount - 1)
  ) {
    longTermAction = 'BUY';
    longTermExplanationKey = 'timeframe.long.buyReady';
  } else if (
    usingFullComposite
      ? longTermScore >= 45 &&
        buy.longTerm &&
        priceTrend.bullish &&
        stochRsi.probableBuy
      : longTermScore >= 45 &&
        bullishCount > 0 &&
        bearishCount === 0
  ) {
    longTermAction = 'PROBABLE_BUY';
    longTermExplanationKey = 'timeframe.long.probableBuy';
  } else if (longTermScore >= 20) {
    longTermAction = 'HOLD';
    longTermExplanationKey = liquidityTrendIntact
      ? 'timeframe.long.holdTrendIntact'
      : liquidityTrendWeakening
        ? 'timeframe.long.holdPullback'
        : 'timeframe.long.hold';
  }

  if (
    longTermAction === 'CAUTION' &&
    liquidityTrendIntegrity.canUsePullbacks &&
    !stochRsi.confirmedSell &&
    !liquidityTrendInvalidated &&
    !severeTrendDeterioration
  ) {
    longTermAction = 'HOLD';
    longTermExplanationKey = 'timeframe.long.holdPullback';
  }

  const shortTermPlaceholder = buildTimeframeComposite(
    0,
    'WAIT',
    'timeframe.short.disabled'
  );

  return {
    shortTerm: shortTermPlaceholder,
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

const buildPresentationTimeframeComposite = (
  timeframe: CompositeTimeframes['shortTerm'],
  concept: 'کوتاه‌مدت' | 'میان‌مدت' | 'بلندمدت'
) => {
  return {
    ...timeframe,
    action: labeledValue(
      timeframe.action,
      describeLabel(`اقدام ${concept}`, timeframeActionLabelMap[timeframe.action])
    ),
    quality: labeledValue(
      timeframe.quality,
      describeLabel(
        `کیفیت ${concept}`,
        timeframeQualityLabelMap[timeframe.quality]
      )
    ),
    decision: {
      buy: labeledBoolean(
        timeframe.decision.buy,
        describeLabel(`تصمیم خرید ${concept}`, 'فعال'),
        describeLabel(`تصمیم خرید ${concept}`, 'غیرفعال')
      ),
      sell: labeledBoolean(
        timeframe.decision.sell,
        describeLabel(`تصمیم فروش ${concept}`, 'فعال'),
        describeLabel(`تصمیم فروش ${concept}`, 'غیرفعال')
      ),
      hold: labeledBoolean(
        timeframe.decision.hold,
        describeLabel(`تصمیم نگهداری ${concept}`, 'فعال'),
        describeLabel(`تصمیم نگهداری ${concept}`, 'غیرفعال')
      ),
      wait: labeledBoolean(
        timeframe.decision.wait,
        describeLabel(`تصمیم صبر ${concept}`, 'فعال'),
        describeLabel(`تصمیم صبر ${concept}`, 'غیرفعال')
      ),
      caution: labeledBoolean(
        timeframe.decision.caution,
        describeLabel(`تصمیم احتیاط ${concept}`, 'فعال'),
        describeLabel(`تصمیم احتیاط ${concept}`, 'غیرفعال')
      ),
      reduce: labeledBoolean(
        timeframe.decision.reduce,
        describeLabel(`تصمیم کاهش موقعیت ${concept}`, 'فعال'),
        describeLabel(`تصمیم کاهش موقعیت ${concept}`, 'غیرفعال')
      ),
      exit: labeledBoolean(
        timeframe.decision.exit,
        describeLabel(`تصمیم خروج ${concept}`, 'فعال'),
        describeLabel(`تصمیم خروج ${concept}`, 'غیرفعال')
      )
    },
    positionAdvice: {
      forNewPosition: labeledValue(
        timeframe.positionAdvice.forNewPosition,
        newPositionAdviceLabelMap[timeframe.positionAdvice.forNewPosition]
      ),
      forExistingPosition: labeledValue(
        timeframe.positionAdvice.forExistingPosition,
        existingPositionAdviceLabelMap[
          timeframe.positionAdvice.forExistingPosition
        ]
      )
    }
  };
};

const buildPresentationSignals = (
  regime: AnalysisRegime,
  confidence: AnalysisConfidence,
  buy: BuyTimeframes,
  sell: SellTimeframes,
  stochRsi: StochRsiAnalysis,
  priceTrend: PriceTrendAnalysis,
  trendResilience: TrendResilienceAnalysis,
  mfi: MfiAnalysis,
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
    trendResilience: {
      ...trendResilience,
      status: labeledValue(
        trendResilience.status,
        describeLabel(
          'Trend Resilience Status',
          trendResilience.status === 'OK' ? 'Ready' : 'Insufficient data'
        )
      ),
      resilient: labeledBoolean(
        trendResilience.resilient,
        describeLabel('Trend Resilience', 'Active'),
        describeLabel('Trend Resilience', 'Inactive')
      ),
      strongResilient: labeledBoolean(
        trendResilience.strongResilient,
        describeLabel('Strong Trend Resilience', 'Active'),
        describeLabel('Strong Trend Resilience', 'Inactive')
      ),
      fragile: labeledBoolean(
        trendResilience.fragile,
        describeLabel('Trend Fragility', 'Active'),
        describeLabel('Trend Fragility', 'Inactive')
      )
    },
    mfi: {
      ...mfi,
      status: labeledValue(
        mfi.status,
        describeLabel('Money Flow Index Status', mfiStatusLabelMap[mfi.status])
      ),
      direction: labeledValue(
        mfi.direction,
        describeLabel('Money Flow Index Direction', mfiDirectionLabelMap[mfi.direction])
      ),
      overbought: labeledBoolean(
        mfi.overbought,
        describeLabel('Money Flow Index', 'Overbought'),
        describeLabel('Money Flow Index', 'Not overbought')
      ),
      oversold: labeledBoolean(
        mfi.oversold,
        describeLabel('Money Flow Index', 'Oversold'),
        describeLabel('Money Flow Index', 'Not oversold')
      ),
      bullishConfirmation: labeledBoolean(
        mfi.bullishConfirmation,
        describeLabel('Money Flow Confirmation', 'Bullish'),
        describeLabel('Money Flow Confirmation', 'Not bullish')
      ),
      bearishConfirmation: labeledBoolean(
        mfi.bearishConfirmation,
        describeLabel('Money Flow Confirmation', 'Bearish'),
        describeLabel('Money Flow Confirmation', 'Not bearish')
      ),
      accumulation: labeledBoolean(
        mfi.accumulation,
        describeLabel('Money Flow State', 'Accumulation'),
        describeLabel('Money Flow State', 'No accumulation')
      ),
      distribution: labeledBoolean(
        mfi.distribution,
        describeLabel('Money Flow State', 'Distribution'),
        describeLabel('Money Flow State', 'No distribution')
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
        shortTerm: buildPresentationTimeframeComposite(
          composite.timeframes.shortTerm,
          'کوتاه‌مدت'
        ),
        midTerm: buildPresentationTimeframeComposite(
          composite.timeframes.midTerm,
          'میان‌مدت'
        ),
        longTerm: buildPresentationTimeframeComposite(
          composite.timeframes.longTerm,
          'بلندمدت'
        )
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
  liquidityTrendIntegrity: LiquidityTrendIntegrity,
  mfi: MfiAnalysis,
  adx?: AdxAnalysis,
  atr?: AtrAnalysis,
  liquidityConfirmation?: LiquidityConfirmation,
  components?: AnalysisComponentState,
  trendResilience?: TrendResilienceAnalysis,
  scoringOverrides?: AnalysisScoringOverrides
): CompositeSignal => {
  const weights = resolveScoringOverrides(scoringOverrides);
  const activeComponents = components ?? {
    liquidity: true,
    stochRsi: true,
    priceTrend: true,
    mfi: true,
    adx: true,
    atr: true
  };
  const activeTrendResilience =
    trendResilience ?? calculateTrendResilience(priceTrend);
  const { enabledCount, bullishCount, strongCount, bearishCount, bullishRegime } =
    getCoreSignalVotes({
      regime,
      buy,
      stochRsi,
      priceTrend,
      trendResilience: activeTrendResilience,
      liquidityTrendIntegrity,
      mfi,
      components: activeComponents
    });
  const usingFullComposite =
    activeComponents.liquidity &&
    activeComponents.stochRsi &&
    activeComponents.priceTrend;
  const stochWarning =
    activeComponents.stochRsi &&
    stochRsi.crossDownInRed &&
    !stochRsi.riskSell &&
    !stochRsi.confirmedSell;
  const resilientTrend =
    activeComponents.priceTrend &&
    activeTrendResilience.status === 'OK' &&
    activeTrendResilience.resilient;
  const strongResilientTrend =
    activeComponents.priceTrend &&
    activeTrendResilience.status === 'OK' &&
    activeTrendResilience.strongResilient;
  const mfiBullish = activeComponents.mfi && (mfi.bullishConfirmation || mfi.accumulation);
  const mfiBearish = activeComponents.mfi && (mfi.bearishConfirmation || mfi.distribution);
  const liquidityTrendIntact = liquidityTrendIntegrity.status === 'INTACT';
  const liquidityTrendWeakening = liquidityTrendIntegrity.status === 'WEAKENING';
  const liquidityTrendInvalidated =
    liquidityTrendIntegrity.status === 'INVALIDATED';
  const trendDeteriorating =
    activeComponents.priceTrend &&
    priceTrend.bearish &&
    !resilientTrend;
  const severeTrendDeterioration =
    trendDeteriorating &&
    (!activeComponents.liquidity ||
      liquidityTrendInvalidated ||
      !buy.midTerm);
  const liquidityRegimeIsBullishOrNeutral =
    !activeComponents.liquidity ||
    liquidityTrendIntegrity.canFollowBullishTrend ||
    bullishRegime ||
    regime === 'NEUTRAL';
  const activeSellSignal =
    (activeComponents.stochRsi && (stochRsi.riskSell || stochRsi.confirmedSell)) ||
    severeTrendDeterioration;
  const confirmedSell =
    activeComponents.stochRsi &&
    stochRsi.confirmedSell &&
    (!activeComponents.priceTrend || priceTrend.bearish || priceTrend.warning) &&
    (!activeComponents.liquidity ||
      liquidityTrendInvalidated ||
      !buy.midTerm);
  const confirmedSellButTrendStrong =
    activeComponents.stochRsi &&
    stochRsi.confirmedSell &&
    activeComponents.liquidity &&
    regime === 'STRONG_BULLISH_LIQUIDITY' &&
    buy.midTerm &&
    (!activeComponents.priceTrend || !priceTrend.bearish);
  const riskSell =
    usingFullComposite
      ? activeComponents.stochRsi &&
        stochRsi.riskSell &&
        (liquidityTrendInvalidated ||
          (severeTrendDeterioration &&
            (!liquidityTrendIntegrity.canUsePullbacks || !buy.midTerm)))
      : (activeComponents.stochRsi && stochRsi.riskSell) ||
        (activeComponents.priceTrend && priceTrend.warning);
  const caution =
    usingFullComposite
      ? confirmedSellButTrendStrong ||
        riskSell ||
        liquidityTrendInvalidated
      : bearishCount > 0 || riskSell || (stochWarning && !strongResilientTrend);
  const strongBuy = usingFullComposite
    ? stochRsi.probableBuy &&
      buy.midTerm &&
      buy.longTerm &&
      priceTrend.bullish &&
      !liquidityTrendInvalidated &&
      !mfiBearish &&
      !stochRsi.riskSell &&
      !stochRsi.confirmedSell
    : enabledCount > 0 &&
      strongCount === enabledCount &&
      !riskSell &&
      !confirmedSell;
  const probableBuy = usingFullComposite
      ? stochRsi.probableBuy &&
      liquidityTrendIntegrity.canFollowBullishTrend &&
      !mfiBearish &&
      !stochRsi.confirmedSell &&
      (buy.midTerm ||
        regime === 'CONFIRMED_BULLISH' ||
        priceTrend.direction === 'IMPROVING')
    : bullishCount > 0 &&
      bearishCount === 0 &&
      !confirmedSell &&
      (!activeComponents.liquidity || regime !== 'BEARISH_LIQUIDITY');
  const hold = usingFullComposite
    ? liquidityRegimeIsBullishOrNeutral &&
      !activeSellSignal &&
      !caution &&
      !stochRsi.probableBuy
    : liquidityRegimeIsBullishOrNeutral &&
      !activeSellSignal &&
      bullishCount === 0;
  const adxWeak = activeComponents.adx && adx?.trendStrength === 'WEAK';
  const adxStrongBullish =
    activeComponents.adx &&
    adx?.trendStrength === 'STRONG' &&
    adx.bullishDirectionalBias;
  const adxStrongBearish =
    activeComponents.adx &&
    adx?.trendStrength === 'STRONG' &&
    adx.bearishDirectionalBias;
  const highAtr = activeComponents.atr && atr?.volatilityRegime === 'HIGH';

  let action: CompositeSignal['action'] = usingFullComposite ? 'HOLD' : 'CAUTION';
  let explanationKey = usingFullComposite ? 'composite.hold' : 'composite.caution';

  if (confirmedSell) {
    action = 'CONFIRMED_SELL';
    explanationKey = 'composite.confirmedSell';
  } else if (confirmedSellButTrendStrong) {
    action = 'CAUTION';
    explanationKey = 'composite.confirmedSellButTrendStrong';
  } else if (riskSell) {
    action = 'RISK_SELL';
    explanationKey = 'composite.riskSell';
  } else if (strongBuy) {
    action = 'STRONG_BUY';
    explanationKey = 'composite.strongBuy';
  } else if (probableBuy) {
    action = 'PROBABLE_BUY';
    explanationKey = 'composite.probableBuy';
  } else if (hold) {
    action = 'HOLD';
    explanationKey = 'composite.hold';
  } else if (caution) {
    action = 'CAUTION';
    explanationKey = 'composite.caution';
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

  if (
    usingFullComposite &&
    action === 'CAUTION' &&
    liquidityTrendIntegrity.canUsePullbacks &&
    !liquidityTrendInvalidated &&
    !stochRsi.confirmedSell &&
    !riskSell &&
    !severeTrendDeterioration
  ) {
    action = 'HOLD';
    explanationKey = 'composite.hold';
  }

  const stochPenalty = stochRsi.confirmedSell
    ? activeComponents.stochRsi
      ? -50 * weights.stochRsiWeight
      : 0
    : stochRsi.riskSell && activeComponents.stochRsi
      ? -25 * weights.stochRsiWeight
      : stochWarning && activeComponents.stochRsi
        ? strongResilientTrend
          ? -3 * weights.stochRsiWeight
          : -8 * weights.stochRsiWeight
      : 0;
  const score = clampScore(
    (activeComponents.liquidity ? (buy.midTerm ? 30 : 0) * weights.liquidityWeight : 0) +
      (activeComponents.liquidity
        ? (buy.longTerm ? 25 : 0) * weights.liquidityWeight
        : 0) +
      (activeComponents.stochRsi && stochRsi.probableBuy
        ? 10 * weights.stochRsiWeight
        : 0) +
      (mfiBullish ? 10 * weights.mfiWeight : 0) +
      (activeComponents.liquidity && liquidityTrendIntact
        ? 12 * weights.liquidityWeight
        : 0) +
      (activeComponents.liquidity && liquidityTrendWeakening
        ? 5 * weights.liquidityWeight
        : 0) +
      (strongResilientTrend
        ? 15 * weights.trendResilienceWeight
        : resilientTrend
          ? 8 * weights.trendResilienceWeight
          : 0) +
      (activeComponents.priceTrend && priceTrend.direction === 'BULLISH'
        ? 20 * weights.priceTrendWeight
        : 0) +
      (activeComponents.priceTrend && priceTrend.direction === 'IMPROVING'
        ? 10 * weights.priceTrendWeight
        : 0) +
      (adxWeak ? -10 * weights.adxWeight : 0) +
      (adxStrongBullish ? 5 * weights.adxWeight : 0) +
      (adxStrongBearish ? -10 * weights.adxWeight : 0) +
      (highAtr ? -10 * weights.atrPenaltyWeight : 0) +
      (activeComponents.liquidity && liquidityConfirmation?.liquidityExpansion
        ? 5 * weights.liquidityWeight
        : 0) +
      (activeComponents.liquidity && liquidityConfirmation?.liquidityContraction
        ? -5 * weights.liquidityWeight
        : 0) +
      stochPenalty -
      (activeComponents.liquidity && regime === 'BEARISH_LIQUIDITY'
        ? 35 * weights.liquidityWeight
        : 0) -
      (activeComponents.liquidity && liquidityTrendInvalidated
        ? 20 * weights.liquidityWeight
        : 0) -
      (mfiBearish ? 12 * weights.mfiWeight : 0) -
      (activeComponents.priceTrend && priceTrend.direction === 'BEARISH'
        ? 25 * weights.priceTrendWeight
        : 0) -
      (activeComponents.priceTrend && priceTrend.direction === 'WEAKENING'
        ? 10 * weights.priceTrendWeight
        : 0)
  );
  const timeframes = calculateTimeframeComposites({
    regime,
    buy,
    sell,
    stochRsi,
    priceTrend,
    trendResilience: activeTrendResilience,
    liquidityTrendIntegrity,
    mfi,
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
    ...(liquidityConfirmation ? { liquidityConfirmation } : {}),
    components: activeComponents,
    ...(scoringOverrides ? { scoringOverrides } : {})
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
  const liquidityTrendIntegrity = calculateLiquidityTrendIntegrity(
    {
      latestTradeValue,
      maWeekly: movingAverageAnalysis.maWeekly,
      maMonthly: movingAverageAnalysis.maMonthly,
      maQuarterly: movingAverageAnalysis.maQuarterly,
      weeklySlope: movingAverageAnalysis.weeklySlope,
      monthlySlope: movingAverageAnalysis.monthlySlope,
      quarterlySlope: movingAverageAnalysis.quarterlySlope
    },
    movingAverageAnalysis,
    liquidityConfirmation
  );
  const componentState = buildAnalysisComponentState(params);
  const enabledIndicators = analysisIndicatorComponents.filter(
    (component) => componentState[component]
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
    env.BUY_THRESHOLD_PERCENT,
    liquidityTrendIntegrity
  );
  const stochRsi = calculateStochRsiAnalysis(sortedRows, getStochRsiConfig());
  const priceTrend = calculatePriceTrendAnalysis(
    sortedRows,
    getPriceTrendConfig()
  );
  const trendResilience = calculateTrendResilience(priceTrend);
  const mfi = calculateMfiAnalysis(
    sortedRows,
    MFI_PERIOD,
    MFI_LOWER_THRESHOLD,
    MFI_UPPER_THRESHOLD
  );
  const atr = calculateAtrAnalysis(
    sortedRows,
    env.ATR_PERIOD,
    env.ATR_LOW_VOLATILITY_THRESHOLD,
    env.ATR_HIGH_VOLATILITY_THRESHOLD
  );
  const adx = calculateAdxAnalysis(sortedRows, env.ADX_PERIOD);
  const sell = calculateSellTimeframes(
    regime,
    buy,
    stochRsi,
    priceTrend,
    liquidityTrendIntegrity
  );
  const composite = calculateCompositeSignal(
    regime,
    buy,
    sell,
    stochRsi,
    priceTrend,
    liquidityTrendIntegrity,
    mfi,
    adx,
    atr,
    liquidityConfirmation,
    componentState,
    trendResilience,
    params.scoringOverrides
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
      liquidityContraction: liquidityConfirmation.liquidityContraction,
      liquidityTrendIntegrity
    },
    analysisProfile: {
      indicatorMode: params.indicatorMode ?? 'composite',
      disabledIndicators: [...(params.disabledIndicators ?? [])],
      enabledIndicators
    },
    signals: buildPresentationSignals(
      regime,
      confidence,
      buy,
      sell,
      stochRsi,
      priceTrend,
      trendResilience,
      mfi,
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
