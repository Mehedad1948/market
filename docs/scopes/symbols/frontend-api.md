# Frontend API Integration (symbols)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

