# MVP Plan

## Position

The current product is a backend-only deterministic stock analysis API for Iran market symbols. It already has useful foundations: historical data ingestion, per-symbol analysis, scheduled scans, latest cached analyses, symbol catalog, auth/session schema, subscription schema, watchlist schema, portfolio schema, and notification plumbing.

The MVP should move the product from an indicator API to a decision-support service. Users should quickly answer:

- Which symbols deserve attention today?
- Should I enter, wait, hold, reduce, or exit?
- Why is the system saying that?
- What risk or trigger should I watch next?

This system must remain decision support, not financial advice.

## MVP 1: Trustworthy Signal Engine

### P0: Add Backtesting Before More Signal Tuning

Business value:

- Builds trust before selling subscriptions.
- Shows whether each signal action has useful predictive value.
- Prevents random weight changes that only look good on recent examples.

Implementation notes:

- Store historical signal snapshots and forward outcomes.
- Measure 1-day, 5-day, 20-day, and 60-day forward returns.
- Track max drawdown after signal.
- Group results by action, score bucket, sector, liquidity bucket, and volatility regime.
- Use these results to tune score weights and thresholds.

Acceptance criteria:

- A report can show average return, win rate, max drawdown, and sample count for each composite action.
- Any scoring change can be compared against the previous scoring version.

### P0: Fix Real/Legal Data Handling

Business value:

- Real/legal money flow is important in the Iran market.
- Current implementation stores this data but does not use it in the analysis, which creates user and engineering confusion.

Implementation notes:

- Either integrate real/legal metrics into scoring or remove `includeRealLegal` from the analysis cache hash until it affects output.
- Preferred MVP behavior: integrate it.
- Add individual buy/sell value ratio, individual net inflow, legal support/pressure, and trend over 5/20 days.
- Add a small composite score modifier first, then tune with backtesting.

Acceptance criteria:

- Analysis output explains whether real/legal flow supports or weakens the signal.
- `includeRealLegal=true` produces a meaningful output difference when data exists.

### P0: Add Market And Sector Context

Business value:

- A symbol can look strong in isolation while still underperforming its sector or the total market.
- Relative strength improves ranking quality and reduces weak signals.

Implementation notes:

- Build daily benchmark series for total market and sector groups.
- Add relative strength over 5, 20, and 60 trading days.
- Penalize bullish signals when a symbol underperforms its sector and market.
- Promote symbols that are outperforming their sector with improving liquidity.

Acceptance criteria:

- Output includes market-relative and sector-relative strength fields.
- Latest analyses can be ranked by relative strength.

## MVP 2: Practical User Output

### P0: Add `decisionSummary`

Business value:

- Retail users need a direct, practical interpretation, not only raw indicator states.
- This becomes the main UI payload for symbol detail pages, notifications, and alerts.

Implementation notes:

- Add `decisionSummary` to `GET /api/stocks/:symbol/analysis`.
- Include `headline`, `recommendedAction`, `forNewPosition`, `forExistingPosition`, `riskLevel`, `confidence`, `whyNow`, `mainRisk`, `nextTrigger`, `invalidatedIf`, and `reasonCodes`.
- Keep existing `signals`, `metrics`, and `persianSummary` for compatibility.

Acceptance criteria:

- A frontend can render a useful summary without understanding every indicator.
- The summary clearly separates new-entry guidance from existing-position guidance.

### P0: Improve Latest Analyses For Dashboard Use

Business value:

- The latest list should function as the user's daily opportunity and risk dashboard.
- Users should not need to open every symbol to find important cases.

Implementation notes:

- Add `rankScore`, `opportunityType`, `riskLevel`, `freshness`, `whyNow`, and `composite` to latest-analysis items.
- Keep the list lightweight by avoiding full indicators unless explicitly requested.
- Support filters for action, bias, sector, risk level, and minimum score.

Acceptance criteria:

- The latest endpoint can power top buy setups, top risk alerts, and watchlist highlights.

### P1: Add Risk And Trigger Levels

Business value:

- Users need actionable risk boundaries.
- "Buy" or "sell" without price context is not practical enough.

Implementation notes:

- Add ATR-based volatility stop.
- Add recent swing support and resistance.
- Add distance to resistance and distance to stop.
- Add "do not enter if price is extended" warning.

Acceptance criteria:

- Output includes entry readiness, invalidation level, and nearest resistance/support estimate.

## MVP 3: User Product

### P0: Complete Watchlists And Alert Rules

Business value:

- Watchlists and alerts create retention.
- Users return when the system tells them what changed.

Implementation notes:

- Add authenticated watchlist APIs.
- Add alert rules for action changes, score thresholds, entry timing, risk sell, confirmed sell, and watchlist-only scan results.
- Send Telegram/Bale notifications after scan completion.

Acceptance criteria:

- A user can track symbols and receive alerts after the scheduled scan.

### P0: Enforce Subscription Access

Business value:

- Turns the system into a commercial product.
- Prevents unlimited free usage of expensive data and scan resources.

Implementation notes:

- Gate API usage by plan.
- Add daily quota limits for free/trial users.
- Add premium access to full ranking, alerts, portfolio analysis, and historical backtest stats.

Acceptance criteria:

- Free, trial, and paid users get different access levels.

## MVP 4: Portfolio Layer

### P1: Add Portfolio-Aware Advice

Business value:

- A user who already owns a stock needs different advice from a user looking for a new entry.
- Portfolio context increases perceived value and subscription potential.

Implementation notes:

- Use existing portfolio and holding schema.
- Add current P/L, concentration risk, position-level action, and symbol-specific risk alerts.
- Generate portfolio digest after scans.

Acceptance criteria:

- Users can see which holdings should be held, reduced, monitored, or exited.

## Launch Criteria

- Backtesting report exists for the current scoring version.
- Real/legal behavior is either integrated or removed from cache-significant params.
- Latest analyses can rank and filter daily opportunities.
- Symbol analysis includes `decisionSummary`.
- Scheduled scan status and history are reliable after process restart.
- Watchlist alerts work for at least Telegram/Bale.
- Subscription limits exist for free/trial/paid access.

