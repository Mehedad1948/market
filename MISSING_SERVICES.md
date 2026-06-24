# Missing Services

## Overview

The current backend has several strong foundations, but many product services are still incomplete. These services are needed to turn the analysis engine into a usable commercial MVP.

This system should be positioned as decision support, not financial advice.

## P0: Authentication Flows

Current state:

- Session storage and bearer-token auth foundations exist.
- User and linked auth-account tables exist.
- Provider login flows are not complete.

Missing capabilities:

- SMS login and OTP verification.
- Telegram login or Telegram account linking.
- Google login if needed for web users.
- Session management UI/API.
- Account merge rules for users with multiple login methods.

Business value:

- Required for watchlists, subscriptions, portfolio tracking, and paid access.

## P0: Subscription Enforcement

Current state:

- Plan, subscription, and payment transaction schema exists.
- API access is not clearly gated by plan or quota.

Missing capabilities:

- Middleware to enforce plan status.
- Free/trial/paid feature limits.
- Daily request quotas.
- Limits for scans, alerts, watchlist size, and portfolio size.
- Expired subscription handling.
- discount code generation and applying

Business value:

- Required for monetization and cost control.

## P0: Watchlist APIs

Current state:

- Watchlist schema exists.
- Product-level watchlist workflows are incomplete.

Missing capabilities:

- Add/remove/list watchlist symbols.
- Watchlist grouping or tagging.
- Watchlist latest-analysis endpoint.
- Watchlist-only scan support.
- Per-user watchlist limits by subscription plan.

Business value:

- Watchlists are the core retention loop for retail investors.

## P0: Alert Rules And Notifications

Current state:

- Telegram/Bale notification plumbing exists.
- Alert rules are not modeled as user-owned product features.

Missing capabilities:

- User alert preferences.
- Alert rules for action changes, score thresholds, entry timing, confirmed sell, risk sell, and watchlist changes.
- Alert delivery logs.
- Deduplication so users do not receive the same alert repeatedly.
- Daily digest after scheduled scan.

Business value:

- Alerts make the product useful without requiring users to constantly open the app.

## P0: Persistent Scan History

Current state:

- Runtime scan status is in-memory.
- Status resets when the process restarts.

Missing capabilities:

- Database models for scan runs and scan items.
- APIs to list scan history and inspect a scan result.
- Failure tracking by symbol.
- Change detection versus previous scan.
- Scan duration, coverage, and error metrics.

Business value:

- Users and operators need to know whether the daily scan actually ran and what changed.

## P1: Portfolio Analysis Service

Current state:

- Portfolio and holding schema exists.
- Analysis does not use user holdings.

Missing capabilities:

- Portfolio CRUD APIs.
- Holding import/update APIs.
- Position-level P/L.
- Concentration risk.
- Holding-specific advice.
- Portfolio digest after market close.

Business value:

- Portfolio advice is more valuable than generic symbol analysis because it matches user context.

## P1: Payment Integration

Current state:

- Payment transaction schema exists.
- Provider integration is not complete.

Missing capabilities:

- Iranian payment provider integration.
- Payment initiation and callback endpoints.
- Invoice/payment status handling.
- Subscription activation after payment.
- Renewal reminders and failed payment handling.

Business value:

- Required for paid conversion.

## P1: Admin Operations Panel

Current state:

- Operational state is available only through logs and basic endpoints.

Missing capabilities:

- Catalog import controls.
- Manual scan controls.
- Failed-symbol view.
- API quota/error visibility.
- Cache statistics.
- User/subscription management.
- Notification test and delivery logs.

Business value:

- Reduces operational risk and support time.

## P1: Data Quality Monitoring

Current state:

- Data is normalized and stored, but quality issues are not surfaced as a first-class service.

Missing capabilities:

- Stale symbol detection.
- Missing OHLC/trade-value detection.
- Suspicious price jump detection.
- Insufficient history dashboard.
- Duplicate board review.
- BrsApi failure and latency metrics.

Business value:

- Better data quality directly improves signal trust.

## P2: Frontend Dashboard

Current state:

- Backend APIs exist.
- No production user-facing frontend is present.

Missing capabilities:

- Latest opportunities dashboard.
- Symbol detail page.
- Watchlist page.
- Portfolio page.
- Alerts and notification settings.
- Subscription and payment screens.

Business value:

- Needed for non-technical users and paid conversion.

## P2: Analytics And Growth Services

Missing capabilities:

- User activation funnel.
- Retention metrics.
- Alert open/click tracking.
- Popular symbols.
- Conversion tracking by plan.
- Churn and renewal analysis.

Business value:

- Needed to run the product as a business, not just a tool.

