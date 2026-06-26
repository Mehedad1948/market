# Frontend API Integration (alerts)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

