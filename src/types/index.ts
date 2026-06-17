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

export type CompositeSignal = {
  action: CompositeSignalAction;
  score: number;
  explanationKey: string;
  scoreScale: {
    min: -100;
    max: 100;
  };
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
  };
  signals: {
    regime: AnalysisRegime;
    crossWeeklyAboveMonthly: boolean;
    crossWeeklyBelowMonthly: boolean;
    crossMonthlyAboveQuarterly: boolean;
    crossMonthlyBelowQuarterly: boolean;
    confidence: AnalysisConfidence;
    buy: BuyTimeframes;
    sell: SellTimeframes;
    stochRsi: StochRsiAnalysis;
    priceTrend: PriceTrendAnalysis;
    composite: CompositeSignal;
  };
  persianSummary: string;
  disclaimer: string;
};
