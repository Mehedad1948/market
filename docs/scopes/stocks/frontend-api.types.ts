/* Generated frontend-facing API contract types.
   This file is intentionally standalone so you can copy it into another project.
   Dates are ISO strings in the frontend contract, even when the backend uses Date objects internally. */

export type ErrorResponse = {
  status: 'ERROR';
  message: string;
  englishMessage?: string;
  issues?: unknown;
  preview?: DiscountPreview;
  limit?: number;
  accessLevel?: string;
  [key: string]: unknown;
};

export type DiscountPreview = {
  valid: boolean;
  status:
    | 'VALID'
    | 'NOT_FOUND'
    | 'DISABLED'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'EXHAUSTED'
    | 'INCOMPATIBLE_PLAN'
    | 'MINIMUM_SUBTOTAL_NOT_MET';
  planCode: string;
  originalAmount: string;
  discountAmount: string;
  finalAmount: string;
  currency: string | null;
  code: string | null;
  paymentSnapshot: {
    amountBeforeDiscount: string;
    discountAmount: string;
    finalAmount: string;
    discountCodeSnapshot: string | null;
  };
};

export type SymbolPathParams = {
  symbol: string;
};

export type StockAnalysisQuery = {
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  forceRefresh?: boolean;
  includeRealLegal?: boolean;
};

export type RefreshStockHistoryRequest = {
  includeRealLegal?: boolean;
};

export type StockHistoryQuery = {
  limit?: number;
  offset?: number;
};

export type LatestAnalysesQuery = {
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  includeRealLegal?: boolean;
  includeResult?: boolean;
  limit?: number;
  offset?: number;
};

export type StockAnalysisResult = {
  status: 'OK' | 'INSUFFICIENT_DATA';
  symbol?: string;
  source?: 'database' | 'brsapi' | 'mixed';
  cacheHit?: boolean;
  latestDataDate?: string;
  windows?: {
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  metrics?: Record<string, JsonValue>;
  analysisProfile?: {
    indicatorMode: string;
    disabledIndicators: string[];
    enabledIndicators: string[];
  };
  signals?: Record<string, JsonValue>;
  persianSummary?: string;
  disclaimer?: string;
};

export type StockAnalysisResponse = StockAnalysisResult;

export type RefreshStockHistoryResponse = {
  status: 'OK';
  symbol: string;
  refreshed: true;
  includeRealLegal: boolean;
  rowsUpserted: number;
  latestDataDate: string | null;
};

export type SymbolDailyMetricRow = Record<string, JsonValue>;

export type StockHistoryResponse = {
  status: 'OK';
  symbol: string;
  limit: number;
  offset: number;
  rows: SymbolDailyMetricRow[];
};

export type LatestStockMetricResponse = {
  status: 'OK';
  symbol: string;
  row: SymbolDailyMetricRow;
};

export type SignalScanItem = {
  symbol: string;
  status: 'OK' | 'INSUFFICIENT_DATA' | 'ERROR';
  action: string | null;
  score: number | null;
  latestDataDate: string | null;
  reason?: string;
};

export type ManualSignalScanRequest = {
  symbols?: string[];
  forceRefresh?: boolean;
  includeRealLegal?: boolean;
};

export type SignalScanSummaryResponse = {
  status: 'OK';
  scannedAt: string;
  symbolsRequested: number;
  scannedCount: number;
  okCount: number;
  insufficientDataCount: number;
  errorCount: number;
  results: SignalScanItem[];
};

export type SignalScanScheduleStatus = {
  enabled: boolean;
  cron: string;
  timezone: string;
  isRegistered: boolean;
  taskStatus: string | null;
  nextRunAt: string | null;
  serverTime: string;
  timezoneLocalTime: string;
};

export type SignalScanStatusResponse = {
  status: 'OK';
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastTriggeredAt: string | null;
  lastOutcome: 'SUCCESS' | 'ERROR' | 'NEVER_RAN';
  lastScannedAt: string | null;
  lastSymbolsRequested: number | null;
  lastScannedCount: number | null;
  lastOkCount: number | null;
  lastInsufficientDataCount: number | null;
  lastErrorCount: number | null;
  lastError: string | null;
  currentPhase: string;
  currentPhaseStartedAt: string | null;
  currentSymbol: string | null;
  currentSymbolIndex: number | null;
  symbolsTotal: number | null;
  symbolsCompleted: number | null;
  currentSymbolStartedAt: string | null;
  schedule: SignalScanScheduleStatus;
};

export type LatestAnalysisItem = {
  symbol: string;
  latestDataDate: string;
  analyzedAt: string;
  expiresAt: string;
  action: string | null;
  score: number | null;
  bias: string | null;
  entryTiming: string | null;
  latestClosePrice: number | null;
  latestClosePriceChangePercent: number | null;
  persianSummary: string | null;
  composite?: Record<string, JsonValue>;
};

export type LatestAnalysesResponse = {
  status: 'OK';
  limit: number;
  offset: number;
  items: LatestAnalysisItem[];
};

export type AnalysisScoringOverrides = Partial<{
  liquidityWeight: number;
  stochRsiWeight: number;
  priceTrendWeight: number;
  mfiWeight: number;
  adxWeight: number;
  atrPenaltyWeight: number;
  trendResilienceWeight: number;
}>;

export type RunBacktestRequest = {
  symbols?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxSymbols?: number;
  maxSnapshotsPerSymbol?: number;
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  includeRealLegal?: boolean;
  indicatorMode?:
    | 'composite'
    | 'liquidity_only'
    | 'stochRsi_only'
    | 'priceTrend_only'
    | 'mfi_only';
  disabledIndicators?: AnalysisIndicatorComponent[];
  scoringOverrides?: AnalysisScoringOverrides;
};

export type BacktestRunSummary = {
  id: string;
  status: string;
  paramsHash: string;
  params: JsonValue;
  scoringVersion: number;
  horizons: JsonValue;
  symbols: JsonValue;
  symbolCount: number;
  snapshotCount: number;
  skippedCount: number;
  errorCount: number;
  errors: JsonValue;
  startedAt: string;
  finishedAt: string | null;
};

export type BacktestDrawdownDiagnostic = {
  symbol: string;
  asOfDate: string;
  horizon: string;
  entryClose: number;
  lowestPrice: number | null;
  lowestPriceDate: string | null;
  source: string;
  maxDrawdown: number | null;
};

export type BacktestReportQuery = {
  runId?: string;
  scoringVersion?: number;
  paramsHash?: string;
  symbols?: string;
  dateFrom?: string;
  dateTo?: string;
  sectorName?: string;
  compositeAction?: string;
  compositeBias?: string;
  entryTiming?: string;
  liquidityBucket?: string;
  volatilityRegime?: string;
  timeframe?: 'midTerm' | 'longTerm';
  forNewPosition?: string;
  forExistingPosition?: string;
  minScore?: number;
  maxScore?: number;
  groupBy?:
    | 'compositeAction'
    | 'scoreBucket'
    | 'sector'
    | 'liquidityBucket'
    | 'volatilityRegime'
    | 'bias'
    | 'entryTiming'
    | 'symbol';
  limit?: number;
};

export type BacktestReportResponse = {
  status: 'OK';
  run: BacktestRunSummary;
  filters: Record<string, JsonValue>;
  totalMatchedSnapshots: number;
  returnedSnapshots: number;
  truncated: boolean;
  report: Record<string, JsonValue>;
};

export type CompareBacktestsRequest = {
  symbol: string;
  dateFrom?: string;
  dateTo?: string;
  maxSnapshotsPerSymbol?: number;
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  includeRealLegal?: boolean;
  reportLimit?: number;
  variants?: BacktestComparisonVariant[];
  scoringOverrides?: AnalysisScoringOverrides;
};

export type CompareBacktestsResponse = {
  status: 'OK';
  symbol: string;
  comparisonCount: number;
  variants: Array<{
    key: BacktestComparisonVariant;
    config: {
      indicatorMode?: string;
      disabledIndicators?: AnalysisIndicatorComponent[];
    };
    run: BacktestRunSummary;
    report: Record<string, JsonValue> | null;
    drawdownDiagnostics: BacktestDrawdownDiagnostic[];
    totalMatchedSnapshots: number | null;
    returnedSnapshots: number | null;
    truncated: boolean | null;
  }>;
  compactReport: {
    filePath: string;
    fileName: string;
  };
};
