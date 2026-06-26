# Frontend API Integration (admin)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

