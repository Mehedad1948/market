# Frontend API Integration (watchlist)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

