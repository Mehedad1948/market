# Frontend API Integration

This document is generated from `src/contracts/frontendApi.contract.ts`.

## Base URL

- Local: `http://localhost:3000`
- Production: use your deployed API origin

## Authentication

- Send the bearer session token in the `Authorization` header when the endpoint requires bearer auth.
- Example: `Authorization: Bearer <session-token>`

## Error Shape

```ts
type ErrorResponse = {
  status: 'ERROR';
  message: string;
  englishMessage?: string;
  issues?: unknown;
  limit?: number;
  accessLevel?: string;
  [key: string]: unknown;
};
```

## Endpoints

### GET /

Render the built-in HTML request sample page.

- Operation ID: `getRootPage`
- Scope: `root`
- Auth: `none`
- Success: `200` -> `RootHtmlResponse`
- Error statuses: none

### GET /health

Return the health probe payload.

- Operation ID: `getHealth`
- Scope: `root`
- Auth: `none`
- Success: `200` -> `HealthResponse`
- Error statuses: none

### GET /api/auth/me

Return the current auth session state.

- Operation ID: `getCurrentAuth`
- Scope: `auth`
- Auth: `none`
- Success: `200` -> `CurrentAuthResponse`
- Error statuses: none

### GET /api/auth/subscription

Return the effective subscription access for the authenticated user.

- Operation ID: `getCurrentSubscription`
- Scope: `auth`
- Auth: `bearer`
- Success: `200` -> `SubscriptionAccessResponse`
- Error statuses: `401`, `404`

### POST /api/auth/email/request-otp

Send a login OTP to the provided email address using Resend.

- Operation ID: `requestEmailOtp`
- Scope: `auth`
- Auth: `none`
- Success: `200` -> `EmailOtpRequestResponse`
- Request body type: `EmailOtpRequest`
- Error statuses: `400`, `429`, `500`, `502`
- Notes:
  - This endpoint is for passwordless email login.
  - The backend must be configured with Mailtrap SMTP credentials and a sender address.

### POST /api/auth/email/verify-otp

Verify an email OTP and create or link a session-backed account.

- Operation ID: `verifyEmailOtp`
- Scope: `auth`
- Auth: `none`
- Success: `200` -> `FederatedAuthResponse`
- Request body type: `EmailOtpVerifyRequest`
- Error statuses: `400`, `401`, `404`, `409`
- Notes:
  - If a bearer session is also supplied, the verified email may be linked to the current user.

### POST /api/auth/bale/callback

Authenticate or link a Bale account using the bot callback flow.

- Operation ID: `authenticateWithBale`
- Scope: `auth`
- Auth: `bale-bot-token`
- Success: `200` -> `FederatedAuthResponse`
- Request body type: `BaleCallbackRequest`
- Error statuses: `400`, `401`, `404`, `409`
- Notes:
  - Send `x-bale-bot-token`.
  - If a bearer session is also supplied, the Bale account may be linked to the current user.

### POST /api/auth/telegram/callback

Authenticate or link a Telegram account using Telegram Login Widget data.

- Operation ID: `authenticateWithTelegram`
- Scope: `auth`
- Auth: `none`
- Success: `200` -> `FederatedAuthResponse`
- Request body type: `TelegramCallbackRequest`
- Error statuses: `400`, `401`, `404`, `409`, `500`
- Notes:
  - This is the free Telegram bot/login-widget flow.
  - The backend validates the Telegram signature with `TELEGRAM_BOT_TOKEN`.

### POST /api/auth/google/callback

Authenticate or link a Google account using a Google ID token.

- Operation ID: `authenticateWithGoogle`
- Scope: `auth`
- Auth: `none`
- Success: `200` -> `FederatedAuthResponse`
- Request body type: `GoogleCallbackRequest`
- Error statuses: `400`, `401`, `404`, `409`, `500`
- Notes:
  - The frontend should obtain the ID token from Google Identity Services.
  - The backend validates the token against `GOOGLE_CLIENT_ID`.

### POST /api/auth/logout

Revoke the current bearer session.

- Operation ID: `logoutCurrentSession`
- Scope: `auth`
- Auth: `bearer`
- Success: `200` -> `LogoutResponse`
- Error statuses: `401`

### POST /api/auth/subscription/trial

Activate the trial subscription for the authenticated user.

- Operation ID: `activateTrialSubscription`
- Scope: `auth`
- Auth: `bearer`
- Success: `201` -> `SubscriptionAccessResponse`
- Error statuses: `401`, `404`, `409`, `500`

### POST /api/admin/discount-codes

Create a discount code for internal/admin workflows.

- Operation ID: `createDiscountCode`
- Scope: `admin`
- Auth: `internal-token`
- Success: `201` -> `DiscountCodeResponse`
- Request body type: `CreateDiscountCodeRequest`
- Error statuses: `400`, `401`
- Notes:
  - Send `x-internal-api-token`.

### POST /api/admin/discount-codes/apply

Redeem a discount code for a plan checkout flow through the internal route.

- Operation ID: `applyDiscountCode`
- Scope: `admin`
- Auth: `internal-token`
- Success: `200` -> `DiscountPreviewResponse`
- Request body type: `DiscountCodeCheckoutRequest`
- Error statuses: `400`, `401`, `404`, `409`
- Notes:
  - Send `x-internal-api-token`.

### POST /api/admin/discount-codes/{id}/status

Update a discount code status for internal/admin workflows.

- Operation ID: `updateDiscountCodeStatus`
- Scope: `admin`
- Auth: `internal-token`
- Success: `200` -> `DiscountCodeResponse`
- Path params type: `DiscountCodeIdParams`
- Request body type: `UpdateDiscountCodeStatusRequest`
- Error statuses: `400`, `401`, `404`
- Notes:
  - Send `x-internal-api-token`.

### POST /api/discount-codes/preview

Preview a discount code against a plan for the authenticated user.

- Operation ID: `previewDiscountCode`
- Scope: `discounts`
- Auth: `bearer`
- Success: `200` -> `DiscountPreviewResponse`
- Request body type: `DiscountCodeCheckoutRequest`
- Error statuses: `400`, `401`, `404`

### POST /api/notifications/telegram/test

Trigger the test Bale/Telegram notification endpoint.

- Operation ID: `sendTelegramTestNotification`
- Scope: `notifications`
- Auth: `none`
- Success: `200` -> `NotificationTestResponse`
- Error statuses: none

### POST /api/symbols/import

Import and upsert the symbol catalog from the upstream source.

- Operation ID: `importSymbols`
- Scope: `symbols`
- Auth: `none`
- Success: `200` -> `SymbolImportResponse`
- Error statuses: `502`

### GET /api/symbols/grouped

Return the grouped symbol catalog.

- Operation ID: `getGroupedSymbols`
- Scope: `symbols`
- Auth: `none`
- Success: `200` -> `GroupedSymbolsResponse`
- Query type: `GroupedSymbolsQuery`
- Error statuses: `400`

### GET /api/symbols/search

Search symbols by query text.

- Operation ID: `searchSymbols`
- Scope: `symbols`
- Auth: `none`
- Success: `200` -> `SearchSymbolsResponse`
- Query type: `SearchSymbolsQuery`
- Error statuses: `400`

### POST /api/stocks/scan

Run a manual signal scan across specific or default symbols.

- Operation ID: `runManualSignalScan`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `SignalScanSummaryResponse`
- Request body type: `ManualSignalScanRequest`
- Error statuses: `400`, `409`

### GET /api/stocks/scan/status

Return the in-memory runtime and schedule status for signal scans.

- Operation ID: `getSignalScanStatus`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `SignalScanStatusResponse`
- Error statuses: none

### GET /api/stocks/analyses/latest

Return latest cached analysis summaries.

- Operation ID: `getLatestAnalyses`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `LatestAnalysesResponse`
- Query type: `LatestAnalysesQuery`
- Error statuses: `400`

### POST /api/stocks/backtests/run

Run a backtest across one or more symbols.

- Operation ID: `runBacktest`
- Scope: `stocks`
- Auth: `none`
- Success: `201` -> `RunBacktestResponse`
- Request body type: `RunBacktestRequest`
- Error statuses: `400`, `500`

### POST /api/stocks/backtests/compare

Run and compare multiple backtest variants for one symbol.

- Operation ID: `compareBacktests`
- Scope: `stocks`
- Auth: `none`
- Success: `201` -> `CompareBacktestsResponse`
- Request body type: `CompareBacktestsRequest`
- Error statuses: `400`, `500`

### GET /api/stocks/backtests/reports

Return a backtest report using run filters and grouping.

- Operation ID: `getBacktestReport`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `BacktestReportResponse`
- Query type: `BacktestReportQuery`
- Error statuses: `400`, `404`

### GET /api/stocks/{symbol}/analysis

Return the full stock analysis payload for one symbol.

- Operation ID: `getStockAnalysis`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `StockAnalysisResponse`
- Path params type: `SymbolPathParams`
- Query type: `StockAnalysisQuery`
- Error statuses: `400`, `404`, `502`

### POST /api/stocks/{symbol}/refresh

Refresh and persist stock history for one symbol.

- Operation ID: `refreshStockHistory`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `RefreshStockHistoryResponse`
- Path params type: `SymbolPathParams`
- Request body type: `RefreshStockHistoryRequest`
- Error statuses: `400`, `404`, `502`

### GET /api/stocks/{symbol}/history

Return paginated stored history rows for one symbol.

- Operation ID: `getStockHistory`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `StockHistoryResponse`
- Path params type: `SymbolPathParams`
- Query type: `StockHistoryQuery`
- Error statuses: `400`

### GET /api/stocks/{symbol}/latest

Return the latest stored metric row for one symbol.

- Operation ID: `getLatestStockMetric`
- Scope: `stocks`
- Auth: `none`
- Success: `200` -> `LatestStockMetricResponse`
- Path params type: `SymbolPathParams`
- Error statuses: `400`, `404`

### GET /api/watchlist

List the authenticated user watchlist.

- Operation ID: `listWatchlist`
- Scope: `watchlist`
- Auth: `bearer`
- Success: `200` -> `ListWatchlistResponse`
- Error statuses: `401`

### POST /api/watchlist

Add a symbol to the authenticated user watchlist.

- Operation ID: `addWatchlistSymbol`
- Scope: `watchlist`
- Auth: `bearer`
- Success: `201` -> `AddWatchlistSymbolResponse`
- Request body type: `AddWatchlistSymbolRequest`
- Error statuses: `400`, `401`, `403`, `409`

### DELETE /api/watchlist/{symbol}

Remove a symbol from the authenticated user watchlist.

- Operation ID: `removeWatchlistSymbol`
- Scope: `watchlist`
- Auth: `bearer`
- Success: `200` -> `RemoveWatchlistSymbolResponse`
- Path params type: `SymbolPathParams`
- Error statuses: `400`, `401`, `404`

### GET /api/alerts/rules

List the authenticated user alert rules.

- Operation ID: `listAlertRules`
- Scope: `alerts`
- Auth: `bearer`
- Success: `200` -> `ListAlertRulesResponse`
- Error statuses: `401`

### POST /api/alerts/rules

Create an alert rule for the authenticated user.

- Operation ID: `createAlertRule`
- Scope: `alerts`
- Auth: `bearer`
- Success: `201` -> `CreateAlertRuleResponse`
- Request body type: `CreateAlertRuleRequest`
- Error statuses: `400`, `401`

### DELETE /api/alerts/rules/{id}

Delete an alert rule owned by the authenticated user.

- Operation ID: `deleteAlertRule`
- Scope: `alerts`
- Auth: `bearer`
- Success: `200` -> `DeleteAlertRuleResponse`
- Path params type: `AlertRuleIdParams`
- Error statuses: `400`, `401`, `404`

### GET /api/portfolios

List the authenticated user portfolios.

- Operation ID: `listPortfolios`
- Scope: `root`
- Auth: `bearer`
- Success: `200` -> `ListPortfoliosResponse`
- Error statuses: `401`

### POST /api/portfolios

Create a portfolio for the authenticated user.

- Operation ID: `createPortfolio`
- Scope: `root`
- Auth: `bearer`
- Success: `201` -> `PortfolioResponse`
- Request body type: `CreatePortfolioRequest`
- Error statuses: `400`, `401`

### GET /api/portfolios/{portfolioId}

Return one owned portfolio with holdings and metrics.

- Operation ID: `getPortfolio`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `200` -> `PortfolioResponse`
- Path params type: `PortfolioIdParams`
- Error statuses: `400`, `401`, `404`

### PATCH /api/portfolios/{portfolioId}

Rename one owned portfolio.

- Operation ID: `renamePortfolio`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `200` -> `PortfolioResponse`
- Path params type: `PortfolioIdParams`
- Request body type: `RenamePortfolioRequest`
- Error statuses: `400`, `401`, `404`

### DELETE /api/portfolios/{portfolioId}

Delete one owned portfolio.

- Operation ID: `deletePortfolio`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `200` -> `DeletePortfolioResponse`
- Path params type: `PortfolioIdParams`
- Error statuses: `400`, `401`, `404`

### POST /api/portfolios/{portfolioId}/holdings

Add a holding to one owned portfolio.

- Operation ID: `addPortfolioHolding`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `201` -> `PortfolioResponse`
- Path params type: `PortfolioIdParams`
- Request body type: `CreatePortfolioHoldingRequest`
- Error statuses: `400`, `401`, `404`, `409`

### PUT /api/portfolios/{portfolioId}/holdings/{symbol}

Update one holding in an owned portfolio.

- Operation ID: `updatePortfolioHolding`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `200` -> `PortfolioResponse`
- Path params type: `PortfolioHoldingParams`
- Request body type: `UpdatePortfolioHoldingRequest`
- Error statuses: `400`, `401`, `404`

### DELETE /api/portfolios/{portfolioId}/holdings/{symbol}

Remove one holding from an owned portfolio.

- Operation ID: `removePortfolioHolding`
- Scope: `portfolios`
- Auth: `bearer`
- Success: `200` -> `PortfolioResponse`
- Path params type: `PortfolioHoldingParams`
- Error statuses: `400`, `401`, `404`

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

