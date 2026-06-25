# Frontend API Integration

This document is generated from `src/contracts/frontendApi.contract.ts`.

## Base URL

- Local: `http://localhost:3000`
- Production: use your deployed API origin

## Authentication

- Send the bearer session token in the `Authorization` header.
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
- Auth: `bearer`
- Success: `200` -> `ListWatchlistResponse`
- Error statuses: `401`

### POST /api/watchlist

Add a symbol to the authenticated user watchlist.

- Operation ID: `addWatchlistSymbol`
- Auth: `bearer`
- Success: `201` -> `AddWatchlistSymbolResponse`
- Request body type: `AddWatchlistSymbolRequest`
- Error statuses: `400`, `401`, `403`, `409`
- Notes:
  - The backend normalizes the symbol to uppercase before persisting it.

### DELETE /api/watchlist/{symbol}

Remove a symbol from the authenticated user watchlist.

- Operation ID: `removeWatchlistSymbol`
- Auth: `bearer`
- Success: `200` -> `RemoveWatchlistSymbolResponse`
- Error statuses: `400`, `401`, `404`
- Notes:
  - The route parameter may be sent in any casing.

### GET /api/alerts/rules

List the authenticated user alert rules.

- Operation ID: `listAlertRules`
- Auth: `bearer`
- Success: `200` -> `ListAlertRulesResponse`
- Error statuses: `401`

### POST /api/alerts/rules

Create an alert rule for the authenticated user.

- Operation ID: `createAlertRule`
- Auth: `bearer`
- Success: `201` -> `CreateAlertRuleResponse`
- Request body type: `CreateAlertRuleRequest`
- Error statuses: `400`, `401`
- Notes:
  - Use `type=SIGNAL_ACTION` with `signalAction`.
  - Use `type=SIGNAL_SCORE` with `minScore`.
  - Use `type=WATCHLIST_CHANGE` with `watchlistChangeEvent`.

### DELETE /api/alerts/rules/{id}

Delete an alert rule owned by the authenticated user.

- Operation ID: `deleteAlertRule`
- Auth: `bearer`
- Success: `200` -> `DeleteAlertRuleResponse`
- Error statuses: `400`, `401`, `404`

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source in another frontend project.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

