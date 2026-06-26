# Frontend API Integration (portfolios)

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

