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

export type RootHtmlResponse = string;

export type HealthResponse = {
  status: 'ok - 1';
};

export type AuthenticatedUser = {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  isActive: boolean;
  trialUsed: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedSession = {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurrentAuthResponse = {
  status: 'OK';
  authenticated: boolean;
  user: AuthenticatedUser | null;
  session:
    | {
        id: string;
        expiresAt: string;
        createdAt: string;
      }
    | null;
};

export type BaleCallbackRequest = {
  baleUser: {
    id: string | number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  };
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
};

export type EmailOtpRequest = {
  email: string;
};

export type EmailOtpRequestResponse = {
  status: 'OK';
  channel: 'EMAIL';
  email: string;
  expiresAt: string;
  retryAfterSeconds: number;
};

export type EmailOtpVerifyRequest = {
  email: string;
  code: string;
  displayName?: string | null;
};

export type FederatedAuthResponse = {
  status: 'OK';
  provider: 'BALE' | 'EMAIL' | 'TELEGRAM' | 'GOOGLE';
  authenticated: true;
  token: string;
  user: AuthenticatedUser;
  session: AuthenticatedSession | null;
  authAccount: {
    id: string;
    provider: string;
    providerAccountId: string;
  };
  isNewUser: boolean;
  linkedAccount: boolean;
  isNewAuthAccount: boolean;
};

export type TelegramCallbackRequest = {
  id: string | number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  auth_date: string | number;
  hash: string;
};

export type GoogleCallbackRequest = {
  idToken: string;
  nonce?: string | null;
};

export type LogoutResponse = {
  status: 'OK';
  loggedOut: true;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationDays: number;
  isTrial: boolean;
  isActive: boolean;
};

export type ResolvedSubscription = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
};

export type SubscriptionAccess = {
  userId: string;
  trialUsed: boolean;
  hasAccess: boolean;
  level: 'NONE' | 'TRIAL' | 'PAID';
  reason:
    | 'NO_SUBSCRIPTION'
    | 'ACTIVE_TRIAL'
    | 'ACTIVE_PAID'
    | 'SUBSCRIPTION_INACTIVE';
  subscription: ResolvedSubscription | null;
};

export type SubscriptionAccessResponse = {
  status: 'OK';
  access: SubscriptionAccess;
};

export type DiscountValueType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type CreateDiscountCodeRequest = {
  code: string;
  name: string;
  description?: string | null;
  status?: DiscountCodeStatus;
  valueType: DiscountValueType;
  value: string | number;
  currency?: string | null;
  minimumSubtotalAmount?: string | number | null;
  maximumDiscountAmount?: string | number | null;
  maxRedemptions?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  applicablePlanCodes?: string[];
  metadata?: Record<string, JsonValue>;
};

export type DiscountCodeCheckoutRequest = {
  code: string;
  planCode: string;
};

export type DiscountCode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: DiscountCodeStatus;
  valueType: DiscountValueType;
  value: string;
  currency: string | null;
  minimumSubtotalAmount: string | null;
  maximumDiscountAmount: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
  applicablePlanCodes: string[];
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
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

export type DiscountCodeResponse = {
  status: 'OK';
  discountCode: DiscountCode;
};

export type DiscountPreviewResponse = {
  status: 'OK';
  preview: DiscountPreview;
};

export type DiscountCodeIdParams = {
  id: string;
};

export type UpdateDiscountCodeStatusRequest = {
  status: DiscountCodeStatus;
};

export type NotificationTestResponse = {
  status: 'OK' | 'ERROR';
  sent: boolean;
  telegramConfigured: boolean;
};

export type InstrumentType = 'STOCK' | 'ETF' | 'RIGHT' | 'BOND' | 'UNKNOWN';

export type GroupedSymbolsQuery = {
  grouping?: 'macro' | 'official';
  hideDuplicateBoards?: boolean;
  includeInactive?: boolean;
  includeTypes?: string;
  search?: string;
  format?: 'array' | 'object';
};

export type CatalogSymbolItem = {
  code: string;
  label: string;
  isin: string | null;
  sectorId: string | null;
  sectorName: string | null;
  displaySector: string | null;
  instrumentType: InstrumentType;
  marketGroupKey?: string;
  marketGroupLabel?: string;
  marketGroupIcon?: string;
  baseCode?: string;
  isDuplicateBoard?: boolean;
};

export type CatalogChildGroup = {
  key: string;
  sectorId: string | null;
  label: string;
  displayLabel: string;
  symbolCount: number;
  symbols: CatalogSymbolItem[];
};

export type CatalogGroup = {
  key: string;
  label: string;
  symbolCount: number;
  icon?: string;
  sortOrder?: number;
  children?: CatalogChildGroup[];
  symbols?: CatalogSymbolItem[];
};

export type SymbolImportResponse = {
  status: 'OK';
  source: string;
  importedAt: string;
  summary: Record<string, number>;
};

export type GroupedSymbolsResponse = {
  status: 'OK';
  grouping: 'macro' | 'official';
  updatedAt: string | null;
  groups: CatalogGroup[] | Record<string, CatalogGroup>;
};

export type SearchSymbolsQuery = {
  q: string;
};

export type SearchSymbolsResponse = {
  status: 'OK';
  query: string;
  results: CatalogSymbolItem[];
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

export type WatchlistItem = {
  id: string;
  symbol: string;
  createdAt: string;
};

export type AddWatchlistSymbolRequest = {
  symbol: string;
};

export type ListWatchlistResponse = {
  status: 'OK';
  items: WatchlistItem[];
};

export type AddWatchlistSymbolResponse = {
  status: 'OK';
  item: WatchlistItem;
};

export type RemoveWatchlistSymbolResponse = {
  status: 'OK';
  removed: {
    symbol: string;
  };
};

export type AlertRuleType = 'SIGNAL_ACTION' | 'SIGNAL_SCORE' | 'WATCHLIST_CHANGE';
export type AlertRuleScope = 'ALL_WATCHLIST' | 'SYMBOL';
export type WatchlistChangeEvent = 'ADDED' | 'REMOVED';

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  scope: AlertRuleScope;
  symbol: string | null;
  signalAction: string | null;
  minScore: number | null;
  watchlistChangeEvent: WatchlistChangeEvent | null;
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAlertRuleRequest = {
  type: AlertRuleType;
  scope?: AlertRuleScope;
  symbol?: string | null;
  signalAction?: string | null;
  minScore?: number | null;
  watchlistChangeEvent?: WatchlistChangeEvent | null;
  enabled?: boolean;
  cooldownMinutes?: number;
};

export type AlertRuleIdParams = {
  id: string;
};

export type ListAlertRulesResponse = {
  status: 'OK';
  rules: AlertRule[];
};

export type CreateAlertRuleResponse = {
  status: 'OK';
  rule: AlertRule;
};

export type DeleteAlertRuleResponse = {
  status: 'OK';
  removed: {
    id: string;
  };
};

export type PortfolioMetrics = {
  holdingsCount: number;
  pricedHoldingsCount: number;
  unpricedHoldingsCount: number;
  totalCostBasis: number | null;
  totalMarketValue: number | null;
  totalUnrealizedProfitLoss: number | null;
  totalUnrealizedProfitLossPercent: number | null;
  topHoldingWeight: number | null;
  top3Weight: number | null;
  concentrationHhi: number | null;
};

export type PortfolioHolding = {
  id: string;
  symbol: string;
  quantity: number;
  averageBuyPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestDataDate: string | null;
  currentPrice: number | null;
  latestClosePriceChangePercent: number | null;
  metrics: {
    costBasis: number | null;
    marketValue: number | null;
    unrealizedProfitLoss: number | null;
    unrealizedProfitLossPercent: number | null;
  };
  actionGuidance:
    | {
        compositeAction: string;
        bias: string;
        score: number;
        entryTiming: string;
        recommendedAction: string;
        existingPositionAdvice: {
          shortTerm: string;
          midTerm: string;
          longTerm: string;
        };
        persianSummary: string;
        analyzedAt: string;
      }
    | null;
  concentrationWeight: number | null;
};

export type Portfolio = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  metrics: PortfolioMetrics;
  holdings: PortfolioHolding[];
};

export type ListPortfoliosResponse = {
  status: 'OK';
  portfolios: Portfolio[];
};

export type PortfolioResponse = {
  status: 'OK';
  portfolio: Portfolio;
};

export type DeletePortfolioResponse = {
  status: 'OK';
  removed: {
    id: string;
    name: string;
  };
};

export type CreatePortfolioRequest = {
  name?: string;
};

export type RenamePortfolioRequest = {
  name: string;
};

export type CreatePortfolioHoldingRequest = {
  symbol: string;
  quantity: number;
  averageBuyPrice?: number | null;
  notes?: string | null;
};

export type UpdatePortfolioHoldingRequest = {
  quantity: number;
  averageBuyPrice?: number | null;
  notes?: string | null;
};

export type PortfolioIdParams = {
  portfolioId: string;
};

export type PortfolioHoldingParams = {
  portfolioId: string;
  symbol: string;
};
