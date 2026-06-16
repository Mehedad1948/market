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
  };
  persianSummary: string;
  disclaimer: string;
};
