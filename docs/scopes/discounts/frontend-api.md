# Frontend API Integration (discounts)

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

### POST /api/discount-codes/preview

Preview a discount code against a plan for the authenticated user.

- Operation ID: `previewDiscountCode`
- Scope: `discounts`
- Auth: `bearer`
- Success: `200` -> `DiscountPreviewResponse`
- Request body type: `DiscountCodeCheckoutRequest`
- Error statuses: `400`, `401`, `404`

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

