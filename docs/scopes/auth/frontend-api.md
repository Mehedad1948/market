# Frontend API Integration (auth)

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

## Frontend Type Source

Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source for this scope.

## Machine-Readable Contract

Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.

