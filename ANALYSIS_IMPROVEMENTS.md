# Analysis Improvements

## Overview

The current analysis combines liquidity structure, Stoch RSI timing, price trend, ATR volatility, ADX trend strength, and a composite signal. This is a useful base, but the next improvements should focus on measured accuracy, market context, and practical user output.

This system should remain deterministic and explainable for MVP. Machine learning should come later, after enough historical signal and outcome data exists.

## P0: Backtesting And Outcome Tracking

Problem:

- Current scoring is deterministic but not yet validated against historical outcomes.

Recommendation:

- Build a backtesting module that replays historical dates and stores signal snapshots.
- Measure forward returns over 1, 5, 20, and 60 trading days.
- Measure max adverse excursion and max favorable excursion.
- Compare results by action, score bucket, sector, liquidity bucket, and volatility regime.

Business value:

- Converts the product from "indicator output" to evidence-backed decision support.

Implementation notes:

- Version every scoring model with `COMPOSITE_SCORING_VERSION`.
- Keep old scoring outputs comparable.
- Use the backtest report to tune thresholds instead of manually guessing weights.

## P0: Real/Legal Money Flow Integration

Problem:

- Real/legal data can be fetched and stored, but current analysis does not use it in scoring.
- `includeRealLegal` currently affects cache identity more than actual business behavior.

Recommendation:

- Add real/legal money-flow features:
  - individual net buy value
  - individual buy/sell value ratio
  - legal support during negative days
  - legal distribution during positive days
  - 5-day and 20-day real/legal flow trend

Business value:

- This is highly relevant for Iran market users and can become a premium differentiator.

Implementation notes:

- Add a small score modifier first.
- Expose a clear explanation in output.
- Tune weight after backtesting.

## P0: Market And Sector Relative Strength

Problem:

- A symbol can look bullish against its own history while underperforming the market or its sector.

Recommendation:

- Add benchmark series for total market and sector groups.
- Compute relative strength over 5, 20, and 60 trading days.
- Promote symbols outperforming both market and sector.
- Penalize bullish setups that underperform during broad strength.

Business value:

- Improves ranking and helps users focus on leadership stocks.

Implementation notes:

- Start with sector-level grouped symbol aggregates if official benchmark data is not available.
- Store benchmark daily values so analysis is reproducible.

## P1: Adjusted Price And Corporate Action Handling

Problem:

- Splits, capital increases, rights issues, and abnormal adjustments can distort moving averages, Stoch RSI, ATR, and ADX.

Recommendation:

- Detect suspicious jumps.
- Add adjusted-price support when reliable data is available.
- Flag analysis as lower confidence when adjustment risk exists.

Business value:

- Reduces false signals and user complaints around visibly wrong charts.

Implementation notes:

- Add `dataQualityWarnings` to the analysis output.
- Exclude or adjust abnormal rows before indicator calculation where possible.

## P1: Support, Resistance, And Risk Levels

Problem:

- The current output says what the signal is, but not where the trade becomes invalid or risky.

Recommendation:

- Detect recent swing highs and lows.
- Estimate nearest support and resistance.
- Add ATR-based stop/risk level.
- Add distance-to-resistance and distance-to-stop.

Business value:

- Makes the output more actionable and practical for users.

Implementation notes:

- Keep this as decision support, not guaranteed price targets.
- Add warnings when price is too close to resistance or too far from support.

## P1: Regime-Specific Scoring

Problem:

- The same thresholds are used across market conditions.

Recommendation:

- Add market regimes:
  - bullish market
  - bearish market
  - sideways market
  - high-volatility market
  - sector rotation

Business value:

- Reduces overtrading in weak markets and improves confidence in strong markets.

Implementation notes:

- Use benchmark trend, volatility, and breadth.
- Adjust buy thresholds and risk penalties by regime.

## P1: Practical Final Output

Problem:

- The current response is comprehensive but still indicator-centric.

Recommendation:

- Add `decisionSummary` with:
  - `headline`
  - `recommendedAction`
  - `forNewPosition`
  - `forExistingPosition`
  - `riskLevel`
  - `confidence`
  - `whyNow`
  - `mainRisk`
  - `nextTrigger`
  - `invalidatedIf`
  - `reasonCodes`

Business value:

- Allows a frontend, Telegram alert, or mobile app to show a clear decision without parsing all indicators.

Implementation notes:

- Keep full indicators available for advanced users.
- Use the concise summary as the default UX layer.

## P1: Latest Analysis Ranking

Problem:

- Latest cached analyses return summary fields, but they do not fully rank opportunities.

Recommendation:

- Add dashboard-oriented fields:
  - `rankScore`
  - `opportunityType`
  - `riskLevel`
  - `freshness`
  - `whyNow`
  - `sector`
  - `relativeStrength`

Business value:

- Turns the scan output into a daily actionable dashboard.

Implementation notes:

- Rank confirmed sell alerts separately from buy opportunities.
- Do not mix "best buys" and "highest risk exits" in one unlabelled list.

## P2: Personalization

Problem:

- Different users have different timeframes and risk tolerance.

Recommendation:

- Add user strategy profiles:
  - short-term trader
  - swing trader
  - long-term holder
  - risk-averse investor

Business value:

- Makes recommendations feel more relevant and supports premium plans.

Implementation notes:

- Do this after MVP output is stable.
- Keep raw analysis unchanged; personalize only the presentation and ranking layer first.

## P2: Machine Learning Ranking

Problem:

- Deterministic scoring may miss nonlinear patterns.

Recommendation:

- Use ML only after backtesting and historical signal storage exist.
- Start with ranking, not direct buy/sell generation.

Business value:

- Can improve prioritization while preserving explainability.

Implementation notes:

- Features should include technical indicators, liquidity, real/legal flow, sector relative strength, market regime, and volatility.
- Keep deterministic rules as guardrails.

