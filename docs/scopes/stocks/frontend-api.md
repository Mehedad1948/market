# Frontend API Integration (stocks)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

