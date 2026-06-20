export type BrsHistoryTradeRow = {
  date?: string;
  time?: string;
  tno?: string | number | null;
  tvol?: string | number | null;
  tval?: string | number | null;
  pmin?: string | number | null;
  pmax?: string | number | null;
  py?: string | number | null;
  pf?: string | number | null;
  pl?: string | number | null;
  plc?: string | number | null;
  plp?: string | number | null;
  pc?: string | number | null;
  pcc?: string | number | null;
  pcp?: string | number | null;
  [key: string]: unknown;
};

export type BrsRealLegalRow = {
  date?: string;
  Buy_CountI?: string | number | null;
  Buy_CountN?: string | number | null;
  Sell_CountI?: string | number | null;
  Sell_CountN?: string | number | null;
  Buy_I_Volume?: string | number | null;
  Buy_N_Volume?: string | number | null;
  Sell_I_Volume?: string | number | null;
  Sell_N_Volume?: string | number | null;
  Buy_I_Value?: string | number | null;
  Sell_I_Value?: string | number | null;
  [key: string]: unknown;
};

export type SymbolAnalysisParams = {
  weeklyWindow: number;
  monthlyWindow: number;
  quarterlyWindow: number;
  forceRefresh: boolean;
  includeRealLegal: boolean;
};

export type MovingAverageAnalysis = {
  maWeekly: number;
  maMonthly: number;
  maQuarterly: number;
  weeklySlope: number;
  monthlySlope: number;
  quarterlySlope: number;
  crossWeeklyAboveMonthly: boolean;
  crossWeeklyBelowMonthly: boolean;
  crossMonthlyAboveQuarterly: boolean;
  crossMonthlyBelowQuarterly: boolean;
};

export type LiquidityMetrics = {
  latestTradeValue: number;
  maWeekly: number;
  maMonthly: number;
  maQuarterly: number;
  weeklySlope: number;
  monthlySlope: number;
  quarterlySlope: number;
};

export type LiquidityConfirmation = {
  relativeTradeValue20: number | null;
  liquidityExpansion: boolean;
  liquidityContraction: boolean;
};

export type BuyTimeframes = {
  shortTerm: boolean;
  midTerm: boolean;
  longTerm: boolean;
};

export type SellTimeframes = {
  shortTerm: boolean;
  midTerm: boolean;
  longTerm: boolean;
};

export type StochRsiZone = 'RED' | 'GREEN' | 'NEUTRAL' | 'UNKNOWN';

export type StochRsiPoint = {
  date: string;
  rsi: number | null;
  stochRsi: number | null;
  k: number | null;
  d: number | null;
  zone: StochRsiZone;
  crossUp: boolean;
  crossDown: boolean;
  crossUpInGreen: boolean;
  crossDownInRed: boolean;
};

export type StochRsiAnalysisStatus = 'OK' | 'INSUFFICIENT_DATA';

export type StochRsiAnalysis = {
  status: StochRsiAnalysisStatus;
  latestDate: string | null;
  latestK: number | null;
  latestD: number | null;
  latestZone: StochRsiZone;
  upperThreshold: number;
  lowerThreshold: number;
  crossUpInGreen: boolean;
  crossDownInRed: boolean;
  redBearishCrossCount: number;
  greenBullishCrossCount: number;
  barsSinceLastGreenCrossUp: number | null;
  barsSinceLastRedCrossDown: number | null;
  probableBuy: boolean;
  riskSell: boolean;
  confirmedSell: boolean;
};

export type CompositeSignalAction =
  | 'STRONG_BUY'
  | 'PROBABLE_BUY'
  | 'HOLD'
  | 'CAUTION'
  | 'RISK_SELL'
  | 'CONFIRMED_SELL';

export type CompositeBias =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG_BEARISH';

export type CompositeEntryTiming =
  | 'READY'
  | 'PROBABLE'
  | 'NOT_READY'
  | 'RISKY'
  | 'AVOID';

export type TimeframeAction =
  | 'BUY'
  | 'PROBABLE_BUY'
  | 'HOLD'
  | 'WAIT'
  | 'CAUTION'
  | 'REDUCE'
  | 'EXIT';

export type TimeframeQuality =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'WEAK'
  | 'BEARISH';

export type TimeframeComposite = {
  score: number;
  action: TimeframeAction;
  quality: TimeframeQuality;
  explanationKey: string;
};

export type CompositeTimeframes = {
  shortTerm: TimeframeComposite;
  midTerm: TimeframeComposite;
  longTerm: TimeframeComposite;
};

export type CompositeSignal = {
  action: CompositeSignalAction;
  score: number;
  bias: CompositeBias;
  entryTiming: CompositeEntryTiming;
  explanationKey: string;
  scoreScale: {
    min: -100;
    max: 100;
  };
  timeframes: CompositeTimeframes;
};

export type AtrVolatilityRegime =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'INSUFFICIENT_DATA';

export type AtrAnalysis = {
  status: 'OK' | 'INSUFFICIENT_DATA';
  period: number;
  latestAtr: number | null;
  latestAtrPercent: number | null;
  volatilityRegime: AtrVolatilityRegime;
};

export type AdxTrendStrength =
  | 'WEAK'
  | 'MODERATE'
  | 'STRONG'
  | 'INSUFFICIENT_DATA';

export type AdxAnalysis = {
  status: 'OK' | 'INSUFFICIENT_DATA';
  period: number;
  latestAdx: number | null;
  latestPlusDi: number | null;
  latestMinusDi: number | null;
  trendStrength: AdxTrendStrength;
  bullishDirectionalBias: boolean;
  bearishDirectionalBias: boolean;
};

export type StochRsiConfig = {
  rsiLength: number;
  stochLength: number;
  kSmooth: number;
  dSmooth: number;
  upper: number;
  lower: number;
  sellLookback: number;
  buyLookback: number;
  signalMaxAge: number;
  minCrossDistance: number;
};

export type PriceMaType = 'EMA' | 'SMA';

export type PriceTrendDirection =
  | 'BULLISH'
  | 'IMPROVING'
  | 'NEUTRAL'
  | 'WEAKENING'
  | 'BEARISH'
  | 'INSUFFICIENT_DATA';

export type PriceTrendAnalysis = {
  status: 'OK' | 'INSUFFICIENT_DATA';
  latestDate: string | null;
  latestClosePrice: number | null;
  fastMa: number | null;
  midMa: number | null;
  longMa: number | null;
  fastSlope: number | null;
  midSlope: number | null;
  longSlope: number | null;
  closeAboveFastMa: boolean;
  closeAboveMidMa: boolean;
  closeAboveLongMa: boolean;
  fastAboveMidMa: boolean;
  midAboveLongMa: boolean;
  direction: PriceTrendDirection;
  bullish: boolean;
  bearish: boolean;
  warning: boolean;
};

export type PriceTrendConfig = {
  fastWindow: number;
  midWindow: number;
  longWindow: number;
  maType: PriceMaType;
  minSlope: number;
};

export type AnalysisRegime =
  | 'STRONG_BULLISH_LIQUIDITY'
  | 'EARLY_BULLISH'
  | 'CONFIRMED_BULLISH'
  | 'SHORT_TERM_WARNING'
  | 'BEARISH_LIQUIDITY'
  | 'NEUTRAL';

export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type LabeledValue<T> = {
  label: string;
  value: T;
};

export type AdxDirectionalBiasValue = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type StockAnalysisSignals = {
  regime: LabeledValue<AnalysisRegime>;
  crossWeeklyAboveMonthly: LabeledValue<boolean>;
  crossWeeklyBelowMonthly: LabeledValue<boolean>;
  crossMonthlyAboveQuarterly: LabeledValue<boolean>;
  crossMonthlyBelowQuarterly: LabeledValue<boolean>;
  confidence: LabeledValue<AnalysisConfidence>;
  buy: {
    shortTerm: LabeledValue<boolean>;
    midTerm: LabeledValue<boolean>;
    longTerm: LabeledValue<boolean>;
  };
  sell: {
    shortTerm: LabeledValue<boolean>;
    midTerm: LabeledValue<boolean>;
    longTerm: LabeledValue<boolean>;
  };
  stochRsi: Omit<
    StochRsiAnalysis,
    | 'status'
    | 'latestZone'
    | 'crossUpInGreen'
    | 'crossDownInRed'
    | 'probableBuy'
    | 'riskSell'
    | 'confirmedSell'
  > & {
    status: LabeledValue<StochRsiAnalysisStatus>;
    latestZone: LabeledValue<StochRsiZone>;
    crossUpInGreen: LabeledValue<boolean>;
    crossDownInRed: LabeledValue<boolean>;
    probableBuy: LabeledValue<boolean>;
    riskSell: LabeledValue<boolean>;
    confirmedSell: LabeledValue<boolean>;
  };
  priceTrend: Omit<
    PriceTrendAnalysis,
    | 'status'
    | 'direction'
    | 'closeAboveFastMa'
    | 'closeAboveMidMa'
    | 'closeAboveLongMa'
    | 'fastAboveMidMa'
    | 'midAboveLongMa'
    | 'bullish'
    | 'bearish'
    | 'warning'
  > & {
    status: LabeledValue<PriceTrendAnalysis['status']>;
    direction: LabeledValue<PriceTrendDirection>;
    closeAboveFastMa: LabeledValue<boolean>;
    closeAboveMidMa: LabeledValue<boolean>;
    closeAboveLongMa: LabeledValue<boolean>;
    fastAboveMidMa: LabeledValue<boolean>;
    midAboveLongMa: LabeledValue<boolean>;
    bullish: LabeledValue<boolean>;
    bearish: LabeledValue<boolean>;
    warning: LabeledValue<boolean>;
  };
  adx: Omit<
    AdxAnalysis,
    | 'status'
    | 'trendStrength'
    | 'bullishDirectionalBias'
    | 'bearishDirectionalBias'
  > & {
    status: LabeledValue<AdxAnalysis['status']>;
    trendStrength: LabeledValue<AdxTrendStrength>;
    directionalBias: LabeledValue<AdxDirectionalBiasValue>;
    bullishDirectionalBias: LabeledValue<boolean>;
    bearishDirectionalBias: LabeledValue<boolean>;
  };
  atr: Omit<AtrAnalysis, 'status' | 'volatilityRegime'> & {
    status: LabeledValue<AtrAnalysis['status']>;
    volatilityRegime: LabeledValue<AtrVolatilityRegime>;
  };
  composite: Omit<
    CompositeSignal,
    'action' | 'bias' | 'entryTiming' | 'timeframes'
  > & {
    action: LabeledValue<CompositeSignalAction>;
    bias: LabeledValue<CompositeBias>;
    entryTiming: LabeledValue<CompositeEntryTiming>;
    timeframes: {
      shortTerm: Omit<TimeframeComposite, 'action' | 'quality'> & {
        action: LabeledValue<TimeframeAction>;
        quality: LabeledValue<TimeframeQuality>;
      };
      midTerm: Omit<TimeframeComposite, 'action' | 'quality'> & {
        action: LabeledValue<TimeframeAction>;
        quality: LabeledValue<TimeframeQuality>;
      };
      longTerm: Omit<TimeframeComposite, 'action' | 'quality'> & {
        action: LabeledValue<TimeframeAction>;
        quality: LabeledValue<TimeframeQuality>;
      };
    };
  };
};

export type StockAnalysisResult = {
  status: 'OK';
  symbol: string;
  source: 'database' | 'brsapi' | 'mixed';
  cacheHit: boolean;
  latestDataDate: string;
  windows: {
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  metrics: {
    latestTradeValue: number | null;
    latestClosePrice: number | null;
    latestClosePriceChangePercent: number | null;
    maWeekly: number;
    maMonthly: number;
    maQuarterly: number;
    weeklySlope: number;
    monthlySlope: number;
    quarterlySlope: number;
    valueChangeVsMonthly: number | null;
    valueChangeVsQuarterly: number | null;
    relativeTradeValue20: number | null;
    liquidityExpansion: boolean;
    liquidityContraction: boolean;
  };
  signals: StockAnalysisSignals;
  persianSummary: string;
  disclaimer: string;
};
