# Frontend API Integration (root)

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

### GET /api/public/stocks/{symbol}/analysis

Return the full stock analysis payload for one symbol through a public alias.

- Operation ID: `getPublicStockAnalysis`
- Scope: `root`
- Auth: `none`
- Success: `200` -> `StockAnalysisResponse`
- Path params type: `SymbolPathParams`
- Query type: `StockAnalysisQuery`
- Error statuses: `400`, `404`, `502`

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

