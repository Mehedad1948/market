export type FrontendEndpointContract = {
  operationId: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  path: string;
  summary: string;
  auth: 'none' | 'bearer' | 'internal-token' | 'bale-bot-token';
  contentType?: 'application/json' | 'text/html';
  pathParamsType?: string;
  queryType?: string;
  requestBodyType?: string;
  responseBodyType: string;
  successStatus: 200 | 201;
  errorStatuses: number[];
  notes?: string[];
};

export const frontendEndpointContracts: FrontendEndpointContract[] = [
  {
    operationId: 'getRootPage',
    method: 'GET',
    path: '/',
    summary: 'Render the built-in HTML request sample page.',
    auth: 'none',
    contentType: 'text/html',
    responseBodyType: 'RootHtmlResponse',
    successStatus: 200,
    errorStatuses: []
  },
  {
    operationId: 'getHealth',
    method: 'GET',
    path: '/health',
    summary: 'Return the health probe payload.',
    auth: 'none',
    responseBodyType: 'HealthResponse',
    successStatus: 200,
    errorStatuses: []
  },
  {
    operationId: 'getCurrentAuth',
    method: 'GET',
    path: '/api/auth/me',
    summary: 'Return the current auth session state.',
    auth: 'none',
    responseBodyType: 'CurrentAuthResponse',
    successStatus: 200,
    errorStatuses: []
  },
  {
    operationId: 'getCurrentSubscription',
    method: 'GET',
    path: '/api/auth/subscription',
    summary: 'Return the effective subscription access for the authenticated user.',
    auth: 'bearer',
    responseBodyType: 'SubscriptionAccessResponse',
    successStatus: 200,
    errorStatuses: [401, 404]
  },
  {
    operationId: 'requestEmailOtp',
    method: 'POST',
    path: '/api/auth/email/request-otp',
    summary: 'Send a login OTP to the provided email address using Resend.',
    auth: 'none',
    requestBodyType: 'EmailOtpRequest',
    responseBodyType: 'EmailOtpRequestResponse',
    successStatus: 200,
    errorStatuses: [400, 429, 500, 502],
    notes: [
      'This endpoint is for passwordless email login.',
      'The backend must be configured with Mailtrap SMTP credentials and a sender address.'
    ]
  },
  {
    operationId: 'verifyEmailOtp',
    method: 'POST',
    path: '/api/auth/email/verify-otp',
    summary: 'Verify an email OTP and create or link a session-backed account.',
    auth: 'none',
    requestBodyType: 'EmailOtpVerifyRequest',
    responseBodyType: 'FederatedAuthResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404, 409],
    notes: [
      'If a bearer session is also supplied, the verified email may be linked to the current user.'
    ]
  },
  {
    operationId: 'authenticateWithBale',
    method: 'POST',
    path: '/api/auth/bale/callback',
    summary: 'Authenticate or link a Bale account using the bot callback flow.',
    auth: 'bale-bot-token',
    requestBodyType: 'BaleCallbackRequest',
    responseBodyType: 'FederatedAuthResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404, 409],
    notes: [
      'Send `x-bale-bot-token`.',
      'If a bearer session is also supplied, the Bale account may be linked to the current user.'
    ]
  },
  {
    operationId: 'authenticateWithTelegram',
    method: 'POST',
    path: '/api/auth/telegram/callback',
    summary: 'Authenticate or link a Telegram account using Telegram Login Widget data.',
    auth: 'none',
    requestBodyType: 'TelegramCallbackRequest',
    responseBodyType: 'FederatedAuthResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404, 409, 500],
    notes: [
      'This is the free Telegram bot/login-widget flow.',
      'The backend validates the Telegram signature with `TELEGRAM_BOT_TOKEN`.'
    ]
  },
  {
    operationId: 'authenticateWithGoogle',
    method: 'POST',
    path: '/api/auth/google/callback',
    summary: 'Authenticate or link a Google account using a Google ID token.',
    auth: 'none',
    requestBodyType: 'GoogleCallbackRequest',
    responseBodyType: 'FederatedAuthResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404, 409, 500],
    notes: [
      'The frontend should obtain the ID token from Google Identity Services.',
      'The backend validates the token against `GOOGLE_CLIENT_ID`.'
    ]
  },
  {
    operationId: 'logoutCurrentSession',
    method: 'POST',
    path: '/api/auth/logout',
    summary: 'Revoke the current bearer session.',
    auth: 'bearer',
    responseBodyType: 'LogoutResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'activateTrialSubscription',
    method: 'POST',
    path: '/api/auth/subscription/trial',
    summary: 'Activate the trial subscription for the authenticated user.',
    auth: 'bearer',
    responseBodyType: 'SubscriptionAccessResponse',
    successStatus: 201,
    errorStatuses: [401, 404, 409, 500]
  },
  {
    operationId: 'createDiscountCode',
    method: 'POST',
    path: '/api/admin/discount-codes',
    summary: 'Create a discount code for internal/admin workflows.',
    auth: 'internal-token',
    requestBodyType: 'CreateDiscountCodeRequest',
    responseBodyType: 'DiscountCodeResponse',
    successStatus: 201,
    errorStatuses: [400, 401],
    notes: ['Send `x-internal-api-token`.']
  },
  {
    operationId: 'applyDiscountCode',
    method: 'POST',
    path: '/api/admin/discount-codes/apply',
    summary: 'Redeem a discount code for a plan checkout flow through the internal route.',
    auth: 'internal-token',
    requestBodyType: 'DiscountCodeCheckoutRequest',
    responseBodyType: 'DiscountPreviewResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404, 409],
    notes: ['Send `x-internal-api-token`.']
  },
  {
    operationId: 'updateDiscountCodeStatus',
    method: 'POST',
    path: '/api/admin/discount-codes/{id}/status',
    summary: 'Update a discount code status for internal/admin workflows.',
    auth: 'internal-token',
    pathParamsType: 'DiscountCodeIdParams',
    requestBodyType: 'UpdateDiscountCodeStatusRequest',
    responseBodyType: 'DiscountCodeResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404],
    notes: ['Send `x-internal-api-token`.']
  },
  {
    operationId: 'previewDiscountCode',
    method: 'POST',
    path: '/api/discount-codes/preview',
    summary: 'Preview a discount code against a plan for the authenticated user.',
    auth: 'bearer',
    requestBodyType: 'DiscountCodeCheckoutRequest',
    responseBodyType: 'DiscountPreviewResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'sendTelegramTestNotification',
    method: 'POST',
    path: '/api/notifications/telegram/test',
    summary: 'Trigger the test Bale/Telegram notification endpoint.',
    auth: 'none',
    responseBodyType: 'NotificationTestResponse',
    successStatus: 200,
    errorStatuses: []
  },
  {
    operationId: 'importSymbols',
    method: 'POST',
    path: '/api/symbols/import',
    summary: 'Import and upsert the symbol catalog from the upstream source.',
    auth: 'none',
    responseBodyType: 'SymbolImportResponse',
    successStatus: 200,
    errorStatuses: [502]
  },
  {
    operationId: 'getGroupedSymbols',
    method: 'GET',
    path: '/api/symbols/grouped',
    summary: 'Return the grouped symbol catalog.',
    auth: 'none',
    queryType: 'GroupedSymbolsQuery',
    responseBodyType: 'GroupedSymbolsResponse',
    successStatus: 200,
    errorStatuses: [400]
  },
  {
    operationId: 'searchSymbols',
    method: 'GET',
    path: '/api/symbols/search',
    summary: 'Search symbols by query text.',
    auth: 'none',
    queryType: 'SearchSymbolsQuery',
    responseBodyType: 'SearchSymbolsResponse',
    successStatus: 200,
    errorStatuses: [400]
  },
  {
    operationId: 'runManualSignalScan',
    method: 'POST',
    path: '/api/stocks/scan',
    summary: 'Run a manual signal scan across specific or default symbols.',
    auth: 'none',
    requestBodyType: 'ManualSignalScanRequest',
    responseBodyType: 'SignalScanSummaryResponse',
    successStatus: 200,
    errorStatuses: [400, 409]
  },
  {
    operationId: 'getSignalScanStatus',
    method: 'GET',
    path: '/api/stocks/scan/status',
    summary: 'Return the in-memory runtime and schedule status for signal scans.',
    auth: 'none',
    responseBodyType: 'SignalScanStatusResponse',
    successStatus: 200,
    errorStatuses: []
  },
  {
    operationId: 'getLatestAnalyses',
    method: 'GET',
    path: '/api/stocks/analyses/latest',
    summary: 'Return latest cached analysis summaries.',
    auth: 'none',
    queryType: 'LatestAnalysesQuery',
    responseBodyType: 'LatestAnalysesResponse',
    successStatus: 200,
    errorStatuses: [400]
  },
  {
    operationId: 'runBacktest',
    method: 'POST',
    path: '/api/stocks/backtests/run',
    summary: 'Run a backtest across one or more symbols.',
    auth: 'none',
    requestBodyType: 'RunBacktestRequest',
    responseBodyType: 'RunBacktestResponse',
    successStatus: 201,
    errorStatuses: [400, 500]
  },
  {
    operationId: 'compareBacktests',
    method: 'POST',
    path: '/api/stocks/backtests/compare',
    summary: 'Run and compare multiple backtest variants for one symbol.',
    auth: 'none',
    requestBodyType: 'CompareBacktestsRequest',
    responseBodyType: 'CompareBacktestsResponse',
    successStatus: 201,
    errorStatuses: [400, 500]
  },
  {
    operationId: 'getBacktestReport',
    method: 'GET',
    path: '/api/stocks/backtests/reports',
    summary: 'Return a backtest report using run filters and grouping.',
    auth: 'none',
    queryType: 'BacktestReportQuery',
    responseBodyType: 'BacktestReportResponse',
    successStatus: 200,
    errorStatuses: [400, 404]
  },
  {
    operationId: 'getStockAnalysis',
    method: 'GET',
    path: '/api/stocks/{symbol}/analysis',
    summary: 'Return the full stock analysis payload for one symbol.',
    auth: 'none',
    pathParamsType: 'SymbolPathParams',
    queryType: 'StockAnalysisQuery',
    responseBodyType: 'StockAnalysisResponse',
    successStatus: 200,
    errorStatuses: [400, 404, 502]
  },
  {
    operationId: 'refreshStockHistory',
    method: 'POST',
    path: '/api/stocks/{symbol}/refresh',
    summary: 'Refresh and persist stock history for one symbol.',
    auth: 'none',
    pathParamsType: 'SymbolPathParams',
    requestBodyType: 'RefreshStockHistoryRequest',
    responseBodyType: 'RefreshStockHistoryResponse',
    successStatus: 200,
    errorStatuses: [400, 404, 502]
  },
  {
    operationId: 'getStockHistory',
    method: 'GET',
    path: '/api/stocks/{symbol}/history',
    summary: 'Return paginated stored history rows for one symbol.',
    auth: 'none',
    pathParamsType: 'SymbolPathParams',
    queryType: 'StockHistoryQuery',
    responseBodyType: 'StockHistoryResponse',
    successStatus: 200,
    errorStatuses: [400]
  },
  {
    operationId: 'getLatestStockMetric',
    method: 'GET',
    path: '/api/stocks/{symbol}/latest',
    summary: 'Return the latest stored metric row for one symbol.',
    auth: 'none',
    pathParamsType: 'SymbolPathParams',
    responseBodyType: 'LatestStockMetricResponse',
    successStatus: 200,
    errorStatuses: [400, 404]
  },
  {
    operationId: 'listWatchlist',
    method: 'GET',
    path: '/api/watchlist',
    summary: 'List the authenticated user watchlist.',
    auth: 'bearer',
    responseBodyType: 'ListWatchlistResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'addWatchlistSymbol',
    method: 'POST',
    path: '/api/watchlist',
    summary: 'Add a symbol to the authenticated user watchlist.',
    auth: 'bearer',
    requestBodyType: 'AddWatchlistSymbolRequest',
    responseBodyType: 'AddWatchlistSymbolResponse',
    successStatus: 201,
    errorStatuses: [400, 401, 403, 409]
  },
  {
    operationId: 'removeWatchlistSymbol',
    method: 'DELETE',
    path: '/api/watchlist/{symbol}',
    summary: 'Remove a symbol from the authenticated user watchlist.',
    auth: 'bearer',
    pathParamsType: 'SymbolPathParams',
    responseBodyType: 'RemoveWatchlistSymbolResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'listAlertRules',
    method: 'GET',
    path: '/api/alerts/rules',
    summary: 'List the authenticated user alert rules.',
    auth: 'bearer',
    responseBodyType: 'ListAlertRulesResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'createAlertRule',
    method: 'POST',
    path: '/api/alerts/rules',
    summary: 'Create an alert rule for the authenticated user.',
    auth: 'bearer',
    requestBodyType: 'CreateAlertRuleRequest',
    responseBodyType: 'CreateAlertRuleResponse',
    successStatus: 201,
    errorStatuses: [400, 401]
  },
  {
    operationId: 'deleteAlertRule',
    method: 'DELETE',
    path: '/api/alerts/rules/{id}',
    summary: 'Delete an alert rule owned by the authenticated user.',
    auth: 'bearer',
    pathParamsType: 'AlertRuleIdParams',
    responseBodyType: 'DeleteAlertRuleResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'listPortfolios',
    method: 'GET',
    path: '/api/portfolios',
    summary: 'List the authenticated user portfolios.',
    auth: 'bearer',
    responseBodyType: 'ListPortfoliosResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'createPortfolio',
    method: 'POST',
    path: '/api/portfolios',
    summary: 'Create a portfolio for the authenticated user.',
    auth: 'bearer',
    requestBodyType: 'CreatePortfolioRequest',
    responseBodyType: 'PortfolioResponse',
    successStatus: 201,
    errorStatuses: [400, 401]
  },
  {
    operationId: 'getPortfolio',
    method: 'GET',
    path: '/api/portfolios/{portfolioId}',
    summary: 'Return one owned portfolio with holdings and metrics.',
    auth: 'bearer',
    pathParamsType: 'PortfolioIdParams',
    responseBodyType: 'PortfolioResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'renamePortfolio',
    method: 'PATCH',
    path: '/api/portfolios/{portfolioId}',
    summary: 'Rename one owned portfolio.',
    auth: 'bearer',
    pathParamsType: 'PortfolioIdParams',
    requestBodyType: 'RenamePortfolioRequest',
    responseBodyType: 'PortfolioResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'deletePortfolio',
    method: 'DELETE',
    path: '/api/portfolios/{portfolioId}',
    summary: 'Delete one owned portfolio.',
    auth: 'bearer',
    pathParamsType: 'PortfolioIdParams',
    responseBodyType: 'DeletePortfolioResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'addPortfolioHolding',
    method: 'POST',
    path: '/api/portfolios/{portfolioId}/holdings',
    summary: 'Add a holding to one owned portfolio.',
    auth: 'bearer',
    pathParamsType: 'PortfolioIdParams',
    requestBodyType: 'CreatePortfolioHoldingRequest',
    responseBodyType: 'PortfolioResponse',
    successStatus: 201,
    errorStatuses: [400, 401, 404, 409]
  },
  {
    operationId: 'updatePortfolioHolding',
    method: 'PUT',
    path: '/api/portfolios/{portfolioId}/holdings/{symbol}',
    summary: 'Update one holding in an owned portfolio.',
    auth: 'bearer',
    pathParamsType: 'PortfolioHoldingParams',
    requestBodyType: 'UpdatePortfolioHoldingRequest',
    responseBodyType: 'PortfolioResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  },
  {
    operationId: 'removePortfolioHolding',
    method: 'DELETE',
    path: '/api/portfolios/{portfolioId}/holdings/{symbol}',
    summary: 'Remove one holding from an owned portfolio.',
    auth: 'bearer',
    pathParamsType: 'PortfolioHoldingParams',
    responseBodyType: 'PortfolioResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  }
];

export const frontendApiTypeSourceHeader = `/* Generated frontend-facing API contract types.
   This file is intentionally standalone so you can copy it into another project.
   Dates are ISO strings in the frontend contract, even when the backend uses Date objects internally. */
`;

export const frontendApiTypesSource = `${frontendApiTypeSourceHeader}
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

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

export type LabeledValue<T> = {
  label: string;
  value: T;
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
  otpCode: string;
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

export type DiscountCodeStatus =
  | 'ACTIVE'
  | 'DISABLED'
  | 'DRAFT';

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

export type AnalysisIndicatorComponent =
  | 'liquidity'
  | 'stochRsi'
  | 'priceTrend'
  | 'mfi'
  | 'adx'
  | 'atr';

export type BacktestComparisonVariant =
  | 'full_composite'
  | 'stochRsi_only'
  | 'priceTrend_only'
  | 'mfi_only'
  | 'liquidity_only'
  | 'composite_without_atr'
  | 'composite_without_adx'
  | 'composite_without_stochRsi'
  | 'composite_without_priceTrend'
  | 'composite_without_mfi';

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

export type RunBacktestResponse =
  | {
      status: 'OK';
      run: BacktestRunSummary;
      diagnostics?: {
        drawdown: BacktestDrawdownDiagnostic[];
      };
    }
  | {
      status: 'ERROR';
      run: BacktestRunSummary;
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
`;

const buildSchemaRef = (name: string) => ({
  $ref: `#/components/schemas/${name}`
});

export type FrontendEndpointScope =
  | 'root'
  | 'auth'
  | 'admin'
  | 'discounts'
  | 'notifications'
  | 'symbols'
  | 'stocks'
  | 'watchlist'
  | 'alerts'
  | 'portfolios';

export const resolveFrontendEndpointScope = (
  endpoint: Pick<FrontendEndpointContract, 'path'>
): FrontendEndpointScope => {
  if (endpoint.path === '/' || endpoint.path === '/health') {
    return 'root';
  }

  if (endpoint.path.startsWith('/api/auth/')) {
    return 'auth';
  }

  if (endpoint.path.startsWith('/api/admin/')) {
    return 'admin';
  }

  if (endpoint.path.startsWith('/api/discount-codes/')) {
    return 'discounts';
  }

  if (endpoint.path.startsWith('/api/notifications/')) {
    return 'notifications';
  }

  if (endpoint.path.startsWith('/api/symbols/')) {
    return 'symbols';
  }

  if (endpoint.path.startsWith('/api/stocks/')) {
    return 'stocks';
  }

  if (endpoint.path.startsWith('/api/watchlist')) {
    return 'watchlist';
  }

  if (endpoint.path.startsWith('/api/alerts/')) {
    return 'alerts';
  }

  if (endpoint.path.startsWith('/api/portfolios/')) {
    return 'portfolios';
  }

  return 'root';
};

const buildOperation = (endpoint: FrontendEndpointContract) => {
  const contentType = endpoint.contentType ?? 'application/json';
  const responses: Record<string, unknown> = {
    [String(endpoint.successStatus)]: {
      description: endpoint.summary,
      content: {
        [contentType]: {
          schema:
            contentType === 'text/html'
              ? { type: 'string' }
              : buildSchemaRef(endpoint.responseBodyType)
        }
      }
    }
  };

  for (const status of endpoint.errorStatuses) {
    responses[String(status)] = {
      description: `Error ${status}`,
      content: {
        'application/json': {
          schema: buildSchemaRef('ErrorResponse')
        }
      }
    };
  }

  const operation: Record<string, unknown> = {
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    tags: [resolveFrontendEndpointScope(endpoint)],
    responses
  };

  if (endpoint.auth === 'bearer') {
    operation.security = [{ bearerAuth: [] }];
  } else if (endpoint.auth === 'internal-token') {
    operation.security = [{ internalApiToken: [] }];
  } else if (endpoint.auth === 'bale-bot-token') {
    operation.security = [{ baleBotToken: [] }];
  }

  if (endpoint.requestBodyType) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: buildSchemaRef(endpoint.requestBodyType)
        }
      }
    };
  }

  const parameters: Array<Record<string, unknown>> = [];

  if (endpoint.path.includes('{symbol}')) {
    parameters.push({
      name: 'symbol',
      in: 'path',
      required: true,
      schema: { type: 'string', minLength: 1 }
    });
  }

  if (endpoint.path.includes('{id}')) {
    parameters.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', minLength: 1 }
    });
  }

  if (endpoint.path.includes('{portfolioId}')) {
    parameters.push({
      name: 'portfolioId',
      in: 'path',
      required: true,
      schema: { type: 'string', minLength: 1 }
    });
  }

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  return operation;
};

const buildPaths = (endpoints: FrontendEndpointContract[] = frontendEndpointContracts) => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of endpoints) {
    const existing = paths[endpoint.path] ?? {};
    existing[endpoint.method.toLowerCase()] = buildOperation(endpoint);
    paths[endpoint.path] = existing;
  }

  return paths;
};

export const buildFrontendApiOpenApiSpec = (
  endpoints: FrontendEndpointContract[] = frontendEndpointContracts,
  info: {
    title: string;
    version: string;
    description: string;
  } = {
    title: 'Market Frontend Integration Contract',
    version: '2026-06-26.1',
    description:
      'Machine-readable contract for all current API endpoints intended for frontend integrations and Codex agents.'
  }
) => ({
  openapi: '3.1.0',
  info,
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development'
    }
  ],
  paths: buildPaths(endpoints),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Bearer session token'
      },
      internalApiToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-internal-api-token'
      },
      baleBotToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-bale-bot-token'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['status', 'message'],
        properties: {
          status: { type: 'string', enum: ['ERROR'] },
          message: { type: 'string' },
          englishMessage: { type: 'string' },
          issues: { type: 'object', additionalProperties: true },
          preview: { type: 'object', additionalProperties: true },
          limit: { type: 'integer' },
          accessLevel: { type: 'string' }
        },
        additionalProperties: true
      },
      HealthResponse: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ok - 1'] }
        }
      },
      CurrentAuthResponse: {
        type: 'object',
        required: ['status', 'authenticated', 'user', 'session'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          authenticated: { type: 'boolean' },
          user: { type: ['object', 'null'], additionalProperties: true },
          session: { type: ['object', 'null'], additionalProperties: true }
        }
      },
      SubscriptionAccessResponse: {
        type: 'object',
        required: ['status', 'access'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          access: { type: 'object', additionalProperties: true }
        }
      },
      BaleCallbackRequest: {
        type: 'object',
        required: ['baleUser'],
        properties: {
          baleUser: { type: 'object', additionalProperties: true },
          email: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          displayName: { type: ['string', 'null'] }
        },
        additionalProperties: false
      },
      EmailOtpRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        },
        additionalProperties: false
      },
      EmailOtpRequestResponse: {
        type: 'object',
        required: ['status', 'channel', 'email', 'otpCode', 'expiresAt', 'retryAfterSeconds'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          channel: { type: 'string', enum: ['EMAIL'] },
          email: { type: 'string', format: 'email' },
          otpCode: { type: 'string', pattern: '^\\d{4,8}$' },
          expiresAt: { type: 'string', format: 'date-time' },
          retryAfterSeconds: { type: 'integer' }
        },
        additionalProperties: false
      },
      EmailOtpVerifyRequest: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{4,8}$' },
          displayName: { type: ['string', 'null'] }
        },
        additionalProperties: false
      },
      FederatedAuthResponse: {
        type: 'object',
        required: ['status', 'provider', 'authenticated', 'token', 'user'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          provider: { type: 'string', enum: ['BALE', 'EMAIL', 'TELEGRAM', 'GOOGLE'] },
          authenticated: { type: 'boolean' },
          token: { type: 'string' },
          user: { type: 'object', additionalProperties: true },
          session: { type: ['object', 'null'], additionalProperties: true },
          authAccount: { type: 'object', additionalProperties: true },
          isNewUser: { type: 'boolean' },
          linkedAccount: { type: 'boolean' },
          isNewAuthAccount: { type: 'boolean' }
        }
      },
      TelegramCallbackRequest: {
        type: 'object',
        required: ['id', 'first_name', 'auth_date', 'hash'],
        properties: {
          id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          first_name: { type: 'string' },
          last_name: { type: ['string', 'null'] },
          username: { type: ['string', 'null'] },
          photo_url: { type: ['string', 'null'] },
          auth_date: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          hash: { type: 'string' }
        },
        additionalProperties: false
      },
      GoogleCallbackRequest: {
        type: 'object',
        required: ['idToken'],
        properties: {
          idToken: { type: 'string' },
          nonce: { type: ['string', 'null'] }
        },
        additionalProperties: false
      },
      LogoutResponse: {
        type: 'object',
        required: ['status', 'loggedOut'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          loggedOut: { type: 'boolean' }
        }
      },
      CreateDiscountCodeRequest: {
        type: 'object',
        required: ['code', 'name', 'valueType', 'value'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          valueType: { type: 'string' },
          value: { anyOf: [{ type: 'string' }, { type: 'number' }] }
        },
        additionalProperties: true
      },
      DiscountCodeCheckoutRequest: {
        type: 'object',
        required: ['code', 'planCode'],
        properties: {
          code: { type: 'string' },
          planCode: { type: 'string' }
        },
        additionalProperties: false
      },
      UpdateDiscountCodeStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' }
        },
        additionalProperties: false
      },
      DiscountCodeResponse: {
        type: 'object',
        required: ['status', 'discountCode'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          discountCode: { type: 'object', additionalProperties: true }
        }
      },
      DiscountPreviewResponse: {
        type: 'object',
        required: ['status', 'preview'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          preview: { type: 'object', additionalProperties: true }
        }
      },
      NotificationTestResponse: {
        type: 'object',
        required: ['status', 'sent', 'telegramConfigured'],
        properties: {
          status: { type: 'string', enum: ['OK', 'ERROR'] },
          sent: { type: 'boolean' },
          telegramConfigured: { type: 'boolean' }
        }
      },
      SymbolImportResponse: {
        type: 'object',
        required: ['status', 'source', 'importedAt', 'summary'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          source: { type: 'string' },
          importedAt: { type: 'string' },
          summary: { type: 'object', additionalProperties: { type: 'number' } }
        }
      },
      GroupedSymbolsResponse: {
        type: 'object',
        required: ['status', 'grouping', 'updatedAt', 'groups'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          grouping: { type: 'string', enum: ['macro', 'official'] },
          updatedAt: { type: ['string', 'null'] },
          groups: {
            oneOf: [
              { type: 'array', items: { type: 'object', additionalProperties: true } },
              { type: 'object', additionalProperties: true }
            ]
          }
        }
      },
      SearchSymbolsResponse: {
        type: 'object',
        required: ['status', 'query', 'results'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          query: { type: 'string' },
          results: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      ManualSignalScanRequest: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' } },
          forceRefresh: { type: 'boolean' },
          includeRealLegal: { type: 'boolean' }
        },
        additionalProperties: false
      },
      SignalScanSummaryResponse: {
        type: 'object',
        required: ['status', 'scannedAt', 'symbolsRequested', 'scannedCount', 'results'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          scannedAt: { type: 'string' },
          symbolsRequested: { type: 'integer' },
          scannedCount: { type: 'integer' },
          okCount: { type: 'integer' },
          insufficientDataCount: { type: 'integer' },
          errorCount: { type: 'integer' },
          results: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      SignalScanStatusResponse: {
        type: 'object',
        required: ['status', 'schedule'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          schedule: { type: 'object', additionalProperties: true }
        },
        additionalProperties: true
      },
      LatestAnalysesResponse: {
        type: 'object',
        required: ['status', 'limit', 'offset', 'items'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          items: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      RunBacktestRequest: {
        type: 'object',
        additionalProperties: true
      },
      RunBacktestResponse: {
        type: 'object',
        required: ['status', 'run'],
        properties: {
          status: { type: 'string', enum: ['OK', 'ERROR'] },
          run: { type: 'object', additionalProperties: true },
          diagnostics: { type: 'object', additionalProperties: true }
        }
      },
      CompareBacktestsRequest: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' }
        },
        additionalProperties: true
      },
      CompareBacktestsResponse: {
        type: 'object',
        required: ['status', 'symbol', 'comparisonCount', 'variants', 'compactReport'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          symbol: { type: 'string' },
          comparisonCount: { type: 'integer' },
          variants: { type: 'array', items: { type: 'object', additionalProperties: true } },
          compactReport: { type: 'object', additionalProperties: true }
        }
      },
      BacktestReportResponse: {
        type: 'object',
        required: ['status', 'run', 'filters', 'report'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          run: { type: 'object', additionalProperties: true },
          filters: { type: 'object', additionalProperties: true },
          totalMatchedSnapshots: { type: 'integer' },
          returnedSnapshots: { type: 'integer' },
          truncated: { type: 'boolean' },
          report: { type: 'object', additionalProperties: true }
        }
      },
      StockAnalysisResponse: {
        type: 'object',
        additionalProperties: true
      },
      RefreshStockHistoryRequest: {
        type: 'object',
        properties: {
          includeRealLegal: { type: 'boolean' }
        },
        additionalProperties: false
      },
      RefreshStockHistoryResponse: {
        type: 'object',
        required: ['status', 'symbol', 'refreshed', 'includeRealLegal', 'rowsUpserted', 'latestDataDate'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          symbol: { type: 'string' },
          refreshed: { type: 'boolean' },
          includeRealLegal: { type: 'boolean' },
          rowsUpserted: { type: 'integer' },
          latestDataDate: { type: ['string', 'null'] }
        }
      },
      StockHistoryResponse: {
        type: 'object',
        required: ['status', 'symbol', 'limit', 'offset', 'rows'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          symbol: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          rows: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      LatestStockMetricResponse: {
        type: 'object',
        required: ['status', 'symbol', 'row'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          symbol: { type: 'string' },
          row: { type: 'object', additionalProperties: true }
        }
      },
      AddWatchlistSymbolRequest: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', minLength: 1 }
        },
        additionalProperties: false
      },
      ListWatchlistResponse: {
        type: 'object',
        required: ['status', 'items'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          items: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      AddWatchlistSymbolResponse: {
        type: 'object',
        required: ['status', 'item'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          item: { type: 'object', additionalProperties: true }
        }
      },
      RemoveWatchlistSymbolResponse: {
        type: 'object',
        required: ['status', 'removed'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          removed: { type: 'object', additionalProperties: true }
        }
      },
      CreateAlertRuleRequest: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string' }
        },
        additionalProperties: true
      },
      ListAlertRulesResponse: {
        type: 'object',
        required: ['status', 'rules'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          rules: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      CreateAlertRuleResponse: {
        type: 'object',
        required: ['status', 'rule'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          rule: { type: 'object', additionalProperties: true }
        }
      },
      DeleteAlertRuleResponse: {
        type: 'object',
        required: ['status', 'removed'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          removed: { type: 'object', additionalProperties: true }
        }
      },
      CreatePortfolioRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      },
      RenamePortfolioRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      },
      CreatePortfolioHoldingRequest: {
        type: 'object',
        required: ['symbol', 'quantity'],
        properties: {
          symbol: { type: 'string' },
          quantity: { type: 'number' },
          averageBuyPrice: { type: ['number', 'null'] },
          notes: { type: ['string', 'null'] }
        },
        additionalProperties: false
      },
      UpdatePortfolioHoldingRequest: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number' },
          averageBuyPrice: { type: ['number', 'null'] },
          notes: { type: ['string', 'null'] }
        },
        additionalProperties: false
      },
      ListPortfoliosResponse: {
        type: 'object',
        required: ['status', 'portfolios'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          portfolios: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      },
      PortfolioResponse: {
        type: 'object',
        required: ['status', 'portfolio'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          portfolio: { type: 'object', additionalProperties: true }
        }
      },
      DeletePortfolioResponse: {
        type: 'object',
        required: ['status', 'removed'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          removed: { type: 'object', additionalProperties: true }
        }
      }
    }
  }
}) as const;

export const frontendApiOpenApiSpec = buildFrontendApiOpenApiSpec();
