# Iran Stock Analysis API

Backend-only Express.js API for analyzing individual Iran stock symbols using BrsApi historical data, PostgreSQL, Prisma, and deterministic TypeScript services.

The analysis is per symbol. It combines traded-value liquidity structure, close-price Stoch RSI timing, and close-price trend confirmation. The output is not financial advice.

## Stack

- Node.js 20+
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Zod
- Axios
- dotenv
- pino
- Vitest
- Docker Compose
- ESLint + Prettier

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run migrations:

```bash
npm run prisma:migrate
```

6. Seed plans:

```bash
npm run prisma:seed
```

7. Start development server:

```bash
npm run dev
```

## Docker

Build the image:

```bash
docker build -t iran-stock-analysis-api .
```

Run it:

```bash
docker run --rm -p 3000:3000 --env-file .env iran-stock-analysis-api
```

Container startup runs `prisma migrate deploy` before the API starts, so `DATABASE_URL` must point to a reachable PostgreSQL instance.

## Environment Variables

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/iran_stock_analysis
BRS_API_KEY=your_key_here
BRS_BASE_URL=https://Api.BrsApi.ir/Tsetmc
AUTH_SESSION_TTL_DAYS=30
CACHE_TTL_SECONDS=86400
ANALYSIS_REQUEST_RETENTION_DAYS=30
ANALYSIS_CACHE_RETENTION_DAYS=7
HISTORY_MAX_AGE_HOURS=24
MARKET_HOURS_HISTORY_MAX_AGE_MINUTES=15
MARKET_TIMEZONE=Asia/Tehran
MARKET_OPEN_TIME=09:00
MARKET_CLOSE_TIME=12:30
DEFAULT_WEEKLY_WINDOW=7
DEFAULT_MONTHLY_WINDOW=30
DEFAULT_QUARTERLY_WINDOW=90
BUY_THRESHOLD_PERCENT=0.02
STOCH_RSI_RSI_LENGTH=14
STOCH_RSI_STOCH_LENGTH=14
STOCH_RSI_K_SMOOTH=5
STOCH_RSI_D_SMOOTH=5
STOCH_RSI_UPPER=80
STOCH_RSI_LOWER=20
STOCH_RSI_SELL_LOOKBACK=12
STOCH_RSI_BUY_LOOKBACK=6
STOCH_RSI_SIGNAL_MAX_AGE=3
STOCH_RSI_MIN_CROSS_DISTANCE=1
PRICE_FAST_MA_WINDOW=20
PRICE_MID_MA_WINDOW=50
PRICE_LONG_MA_WINDOW=200
PRICE_MA_TYPE=EMA
PRICE_TREND_MIN_SLOPE=0
ATR_PERIOD=14
ATR_LOW_VOLATILITY_THRESHOLD=0.015
ATR_HIGH_VOLATILITY_THRESHOLD=0.05
ADX_PERIOD=14
LIQUIDITY_CONFIRMATION_WINDOW=20
LIQUIDITY_EXPANSION_THRESHOLD=1.5
LIQUIDITY_CONTRACTION_THRESHOLD=0.7
SIGNAL_SCAN_ENABLED=true
SIGNAL_SCAN_CRON=0 22 * * 0-4
SIGNAL_SCAN_TIMEZONE=Asia/Tehran
SIGNAL_SCAN_SYMBOLS=
SIGNAL_SCAN_FORCE_REFRESH=false
SIGNAL_SCAN_INCLUDE_REAL_LEGAL=false
SIGNAL_SCAN_SYMBOL_DELAY_MS=30000
COMPOSITE_SCORING_VERSION=3
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

## Auth Foundation

The service now includes database and server-side foundations for:

- users
- linked auth accounts for `GOOGLE`, `TELEGRAM`, and future `SMS`
- hashed bearer sessions in `UserSession`
- subscription plans and user subscriptions
- payment transaction records
- watchlists
- portfolios and holdings

Provider login flows are not implemented yet. The current foundation is limited to:

- Prisma models and migration
- seeded subscription plans, including a 14-day trial plan
- token hashing and session persistence helpers
- request-level current-user extraction from bearer sessions

## API Endpoints

Sample local requests are available in [requests/localhost.http](/D:/projects/market/requests/localhost.http).

### Health

```bash
curl "http://localhost:3000/health"
```

### Current Auth Session

```bash
curl "http://localhost:3000/api/auth/me"
curl "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Logout Current Session

```bash
curl -X POST "http://localhost:3000/api/auth/logout" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Import Symbols Manually

```bash
curl -X POST "http://localhost:3000/api/symbols/import"
```

### Get Grouped Symbols

```bash
curl "http://localhost:3000/api/symbols/grouped"
curl "http://localhost:3000/api/symbols/grouped?grouping=official"
```

### Search Symbols

```bash
curl "http://localhost:3000/api/symbols/search?q=%D8%AE%D9%88%D8%AF%D8%B1%D9%88"
```

### Symbol Catalog Grouping

`BRS/TSETMC` provides official sector names via `sectorName` and `cs`. The app maps official sectors to broader macro groups for better UX. This mapping is curated and can be updated manually.

`GET /api/symbols/grouped` supports:

- `grouping=macro` by default
- `grouping=official` for exact official sector grouping
- `hideDuplicateBoards=true` by default

### Symbol Analysis

```bash
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis"
curl "http://localhost:3000/api/stocks/%D8%AE%D9%88%D8%AF%D8%B1%D9%88/analysis?forceRefresh=true"
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis?weeklyWindow=7&monthlyWindow=30&quarterlyWindow=90&includeRealLegal=false"
```

### Force Refresh

```bash
curl -X POST "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"includeRealLegal\":false}"
```

`includeRealLegal=true` fetches and stores real/legal history during refresh. It does not currently affect the analysis score.

### History

```bash
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/history?limit=50&offset=0"
```

### Latest Stored Metric

```bash
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/latest"
```

### Manual Signal Scan

```bash
curl -X POST "http://localhost:3000/api/stocks/scan" \
  -H "Content-Type: application/json" \
  -d "{\"symbols\":[\"%D9%81%D9%85%D9%84%DB%8C\"],\"forceRefresh\":false,\"includeRealLegal\":false}"
```

If `symbols` is omitted, the scan uses `SIGNAL_SCAN_SYMBOLS` first and then falls back to tracked symbols already stored in the database.

Scheduled and manual scans process symbols sequentially and wait `SIGNAL_SCAN_SYMBOL_DELAY_MS` between symbols to avoid bursting external API and database load.

### Signal Scan Runtime Status

```bash
curl "http://localhost:3000/api/stocks/scan/status"
```

This endpoint is in-memory only. It shows the latest run start time, finish time, outcome, counters, and whether a scan is currently running. The status resets when the process restarts.

### Latest Cached Analyses

```bash
curl "http://localhost:3000/api/stocks/analyses/latest?limit=20"
curl "http://localhost:3000/api/stocks/analyses/latest?limit=20&includeResult=true"
```

## Analysis Logic

The analysis has three deterministic layers:

- Liquidity/value trend from `SymbolDailyMetric.tradeValue`
- Stoch RSI timing and risk trigger from `SymbolDailyMetric.closePrice`
- Price trend confirmation from `SymbolDailyMetric.closePrice`
- ATR volatility context from `priceMin`, `priceMax`, and `closePrice`
- ADX trend-strength confirmation from `priceMin`, `priceMax`, and `closePrice`

### Liquidity Layer

The liquidity layer computes:

- Weekly SMA: `SMA(tradeValue, weeklyWindow)`
- Monthly SMA: `SMA(tradeValue, monthlyWindow)`
- Quarterly SMA: `SMA(tradeValue, quarterlyWindow)`
- Slopes for weekly, monthly, and quarterly SMA series
- Weekly/monthly and monthly/quarterly crossover signals
- `signals.buy.shortTerm`, `signals.buy.midTerm`, and `signals.buy.longTerm`

Liquidity regimes:

- `STRONG_BULLISH_LIQUIDITY`
- `EARLY_BULLISH`
- `CONFIRMED_BULLISH`
- `SHORT_TERM_WARNING`
- `BEARISH_LIQUIDITY`
- `NEUTRAL`

### Stoch RSI Layer

Stoch RSI uses close price and calculates:

- Wilder/RMA RSI
- Raw Stoch RSI on a 0 to 100 scale
- Smoothed K line
- Smoothed D line
- Green-zone bullish crosses
- Red-zone bearish crosses
- `probableBuy`
- `riskSell`
- `confirmedSell`

Stoch RSI is a timing and risk signal. It does not replace the liquidity regime.

### Price Trend Layer

Price trend uses close price and calculates fast, mid, and long moving averages. `PRICE_MA_TYPE=EMA` uses EMA; any supported `SMA` value uses SMA.

Directions:

- `BULLISH`: close > fast MA, fast > mid, mid > long, and slopes are positive enough
- `IMPROVING`: close is above fast MA and fast MA is rising toward or above mid MA
- `NEUTRAL`: no clear directional confirmation
- `WEAKENING`: close is below fast MA and fast slope is negative
- `BEARISH`: close < fast MA, fast < mid, mid < long, and slopes are negative
- `INSUFFICIENT_DATA`: not enough valid close prices for the long MA

## Composite Signal

`signals.composite.action` is the final combined system state. Liquidity is the main filter, Stoch RSI is a timing/risk trigger, and price trend confirms whether the setup is tradable.

`signals.composite.score` still represents the overall directional bias score.

The response now extends the global composite with:

- `signals.composite.bias`: normalized overall bias bucket
- `signals.composite.entryTiming`: global timing interpretation
- `signals.composite.timeframes.shortTerm`: short-term entry and timing quality
- `signals.composite.timeframes.midTerm`: swing and position-holding quality
- `signals.composite.timeframes.longTerm`: strategic trend and holding quality

Within each timeframe:

- `score`: numeric strength on the `-100` to `+100` scale
- `quality`: the structural health of that timeframe
- `action`: the current operational state
- `decision`: explicit boolean flags for UI and rules engines
- `positionAdvice`: separate advice for new entries versus already-held positions

## Freshness And Retention

Analysis requests use the stored database history when it is still fresh enough. Outside market hours, freshness uses `HISTORY_MAX_AGE_HOURS`. During market hours in `MARKET_TIMEZONE`, the service switches to the shorter `MARKET_HOURS_HISTORY_MAX_AGE_MINUTES` threshold.

The service also performs best-effort background cleanup:

- `AnalysisCache` rows are pruned when `expiresAt` has passed
- `AnalysisCache` rows older than `ANALYSIS_CACHE_RETENTION_DAYS` are deleted
- `AnalysisRequest` logs older than `ANALYSIS_REQUEST_RETENTION_DAYS` are deleted

Cleanup is non-blocking in request handlers and does not change the response shape.

Composite actions:

| Action           | Meaning                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `STRONG_BUY`     | Liquidity, Stoch RSI timing, and price trend are aligned bullishly.                                                      |
| `PROBABLE_BUY`   | A Stoch RSI buy trigger exists and liquidity or price trend is supportive, but confirmation is weaker than `STRONG_BUY`. |
| `HOLD`           | No active sell signal and no fresh strong buy trigger.                                                                   |
| `CAUTION`        | Short-term risk exists, or a Stoch RSI sell appears while the main trend is still not fully broken.                      |
| `RISK_SELL`      | Risk reduction is active, usually from Stoch RSI risk plus weak short-term liquidity or price warning.                   |
| `CONFIRMED_SELL` | Stoch RSI confirmed sell is aligned with weak liquidity, weak price trend, or missing mid-term liquidity support.        |

`signals.composite.explanationKey` is a stable machine-readable reason code for clients, logs, and localization. Examples:

- `composite.strongBuy`
- `composite.probableBuy`
- `composite.hold`
- `composite.caution`
- `composite.riskSell`
- `composite.confirmedSell`
- `composite.confirmedSellButTrendStrong`

## Score Scale

`signals.composite.score` and each `signals.composite.timeframes.*.score` are clamped to `-100` through `+100`.

| Score range     | Interpretation                         |
| --------------- | -------------------------------------- |
| `+70` to `+100` | Strong bullish / strong buy condition  |
| `+35` to `+69`  | Bullish / probable buy condition       |
| `+10` to `+34`  | Mild bullish / hold with positive bias |
| `-9` to `+9`    | Neutral / mixed                        |
| `-10` to `-34`  | Caution / weak mixed condition         |
| `-35` to `-69`  | Risk sell / reduce risk                |
| `-70` to `-100` | Strong sell / risk-off condition       |

Scoring version 3 keeps the existing action names and Stoch RSI sell penalties, then applies small ADX, ATR, and liquidity-confirmation modifiers:

- `-50` if `stochRsi.confirmedSell`
- otherwise `-25` if `stochRsi.riskSell`

This avoids double-counting confirmed sell as both risk sell and confirmed sell.

The current MVP also adds:

- ADX as a trend-strength filter and directional-bias modifier
- ATR as a volatility-risk modifier
- Relative traded-value confirmation using `latestTradeValue / avgTradeValue20`

Future improvements intentionally deferred in this MVP:

- Relative strength versus market or sector benchmark time series
- Real/legal money flow integration from `SymbolRealLegalDaily`
- Support and resistance distance using pivot or swing logic plus backtesting

## Example Response Shape

```json
{
  "status": "OK",
  "symbol": "فملی",
  "signals": {
    "regime": {
      "label": "صعودی قوی",
      "value": "STRONG_BULLISH_LIQUIDITY"
    },
    "crossWeeklyAboveMonthly": {
      "label": "بدون سیگنال",
      "value": false
    },
    "crossWeeklyBelowMonthly": {
      "label": "بدون سیگنال",
      "value": false
    },
    "crossMonthlyAboveQuarterly": {
      "label": "بدون سیگنال",
      "value": false
    },
    "crossMonthlyBelowQuarterly": {
      "label": "بدون سیگنال",
      "value": false
    },
    "confidence": {
      "label": "متوسط",
      "value": "MEDIUM"
    },
    "buy": {
      "shortTerm": {
        "label": "فعال",
        "value": true
      },
      "midTerm": {
        "label": "فعال",
        "value": true
      },
      "longTerm": {
        "label": "فعال",
        "value": true
      }
    },
    "sell": {
      "shortTerm": {
        "label": "غیرفعال",
        "value": false
      },
      "midTerm": {
        "label": "غیرفعال",
        "value": false
      },
      "longTerm": {
        "label": "غیرفعال",
        "value": false
      }
    },
    "stochRsi": {
      "status": {
        "label": "آماده",
        "value": "OK"
      },
      "latestDate": "1404-03-20",
      "latestK": 17.42,
      "latestD": 12.85,
      "latestZone": {
        "label": "سبز",
        "value": "GREEN"
      },
      "upperThreshold": 80,
      "lowerThreshold": 20,
      "crossUpInGreen": {
        "label": "تقاطع خرید",
        "value": true
      },
      "crossDownInRed": {
        "label": "بدون سیگنال",
        "value": false
      },
      "redBearishCrossCount": 0,
      "greenBullishCrossCount": 1,
      "barsSinceLastGreenCrossUp": 1,
      "barsSinceLastRedCrossDown": null,
      "probableBuy": {
        "label": "آماده",
        "value": true
      },
      "riskSell": {
        "label": "غیرفعال",
        "value": false
      },
      "confirmedSell": {
        "label": "غیرفعال",
        "value": false
      }
    },
    "priceTrend": {
      "status": {
        "label": "آماده",
        "value": "OK"
      },
      "latestDate": "1404-03-20",
      "latestClosePrice": 575,
      "fastMa": 540.2,
      "midMa": 498.7,
      "longMa": 421.3,
      "fastSlope": 0.03,
      "midSlope": 0.01,
      "longSlope": 0.004,
      "closeAboveFastMa": {
        "label": "بالاتر",
        "value": true
      },
      "closeAboveMidMa": {
        "label": "بالاتر",
        "value": true
      },
      "closeAboveLongMa": {
        "label": "بالاتر",
        "value": true
      },
      "fastAboveMidMa": {
        "label": "بالاتر",
        "value": true
      },
      "midAboveLongMa": {
        "label": "بالاتر",
        "value": true
      },
      "direction": {
        "label": "صعودی",
        "value": "BULLISH"
      },
      "bullish": {
        "label": "صعودی",
        "value": true
      },
      "bearish": {
        "label": "غیرفعال",
        "value": false
      },
      "warning": {
        "label": "عادی",
        "value": false
      }
    },
    "adx": {
      "status": {
        "label": "آماده",
        "value": "OK"
      },
      "period": 14,
      "latestAdx": 32.5,
      "latestPlusDi": 24.1,
      "latestMinusDi": 12.2,
      "trendStrength": {
        "label": "قوی",
        "value": "STRONG"
      },
      "directionalBias": {
        "label": "صعودی",
        "value": "BULLISH"
      },
      "bullishDirectionalBias": {
        "label": "صعودی",
        "value": true
      },
      "bearishDirectionalBias": {
        "label": "غیرفعال",
        "value": false
      }
    },
    "atr": {
      "status": {
        "label": "آماده",
        "value": "OK"
      },
      "period": 14,
      "latestAtr": 12.4,
      "latestAtrPercent": 0.021,
      "volatilityRegime": {
        "label": "عادی",
        "value": "NORMAL"
      }
    },
    "composite": {
      "action": {
        "label": "اقدام نهایی تحلیل: نگهداری",
        "value": "HOLD"
      },
      "score": 60,
      "bias": {
        "label": "سوگیری کلی تحلیل: صعودی",
        "value": "BULLISH"
      },
      "entryTiming": {
        "label": "وضعیت زمان‌بندی ورود: فعلا آماده نیست",
        "value": "NOT_READY"
      },
      "explanationKey": "composite.hold",
      "scoreScale": {
        "min": -100,
        "max": 100
      },
      "timeframes": {
        "shortTerm": {
          "score": 35,
          "action": {
            "label": "اقدام کوتاه‌مدت: صبر",
            "value": "WAIT"
          },
          "quality": {
            "label": "کیفیت کوتاه‌مدت: خنثی",
            "value": "NEUTRAL"
          },
          "decision": {
            "buy": {
              "label": "تصمیم خرید کوتاه‌مدت: غیرفعال",
              "value": false
            },
            "sell": {
              "label": "تصمیم فروش کوتاه‌مدت: غیرفعال",
              "value": false
            },
            "hold": {
              "label": "تصمیم نگهداری کوتاه‌مدت: غیرفعال",
              "value": false
            },
            "wait": {
              "label": "تصمیم صبر کوتاه‌مدت: فعال",
              "value": true
            },
            "caution": {
              "label": "تصمیم احتیاط کوتاه‌مدت: غیرفعال",
              "value": false
            },
            "reduce": {
              "label": "تصمیم کاهش موقعیت کوتاه‌مدت: غیرفعال",
              "value": false
            },
            "exit": {
              "label": "تصمیم خروج کوتاه‌مدت: غیرفعال",
              "value": false
            }
          },
          "positionAdvice": {
            "forNewPosition": {
              "label": "برای ورود جدید: صبر",
              "value": "WAIT"
            },
            "forExistingPosition": {
              "label": "برای دارنده سهم: نظارت",
              "value": "MONITOR"
            }
          },
          "explanationKey": "timeframe.short.wait"
        },
        "midTerm": {
          "score": 75,
          "action": {
            "label": "اقدام میان‌مدت: نگهداری",
            "value": "HOLD"
          },
          "quality": {
            "label": "کیفیت میان‌مدت: صعودی",
            "value": "BULLISH"
          },
          "decision": {
            "buy": {
              "label": "تصمیم خرید میان‌مدت: غیرفعال",
              "value": false
            },
            "sell": {
              "label": "تصمیم فروش میان‌مدت: غیرفعال",
              "value": false
            },
            "hold": {
              "label": "تصمیم نگهداری میان‌مدت: فعال",
              "value": true
            },
            "wait": {
              "label": "تصمیم صبر میان‌مدت: غیرفعال",
              "value": false
            },
            "caution": {
              "label": "تصمیم احتیاط میان‌مدت: غیرفعال",
              "value": false
            },
            "reduce": {
              "label": "تصمیم کاهش موقعیت میان‌مدت: غیرفعال",
              "value": false
            },
            "exit": {
              "label": "تصمیم خروج میان‌مدت: غیرفعال",
              "value": false
            }
          },
          "positionAdvice": {
            "forNewPosition": {
              "label": "برای ورود جدید: صبر تا فعال شدن تریگر ورود",
              "value": "WAIT_FOR_ENTRY_TRIGGER"
            },
            "forExistingPosition": {
              "label": "برای دارنده سهم: نگهداری",
              "value": "HOLD"
            }
          },
          "explanationKey": "timeframe.mid.hold"
        },
        "longTerm": {
          "score": 85,
          "action": {
            "label": "اقدام بلندمدت: نگهداری",
            "value": "HOLD"
          },
          "quality": {
            "label": "کیفیت بلندمدت: صعودی قوی",
            "value": "STRONG_BULLISH"
          },
          "decision": {
            "buy": {
              "label": "تصمیم خرید بلندمدت: غیرفعال",
              "value": false
            },
            "sell": {
              "label": "تصمیم فروش بلندمدت: غیرفعال",
              "value": false
            },
            "hold": {
              "label": "تصمیم نگهداری بلندمدت: فعال",
              "value": true
            },
            "wait": {
              "label": "تصمیم صبر بلندمدت: غیرفعال",
              "value": false
            },
            "caution": {
              "label": "تصمیم احتیاط بلندمدت: غیرفعال",
              "value": false
            },
            "reduce": {
              "label": "تصمیم کاهش موقعیت بلندمدت: غیرفعال",
              "value": false
            },
            "exit": {
              "label": "تصمیم خروج بلندمدت: غیرفعال",
              "value": false
            }
          },
          "positionAdvice": {
            "forNewPosition": {
              "label": "برای ورود جدید: صبر تا فعال شدن تریگر ورود",
              "value": "WAIT_FOR_ENTRY_TRIGGER"
            },
            "forExistingPosition": {
              "label": "برای دارنده سهم: نگهداری",
              "value": "HOLD"
            }
          },
          "explanationKey": "timeframe.long.hold"
        }
      }
    }
  },
  "persianSummary": "...",
  "disclaimer": "این تحلیل صرفاً خروجی یک سیستم تحلیلی است و توصیه خرید یا فروش محسوب نمی‌شود."
}
```

## Cache Behavior

Cache keys use `symbol + paramsHash + latestDataDate`. The params hash includes:

- liquidity windows
- `includeRealLegal`
- `BUY_THRESHOLD_PERCENT`
- `COMPOSITE_SCORING_VERSION`
- all Stoch RSI config values
- all price trend config values

Changing scoring or indicator settings invalidates future cache lookups.

## Testing

```bash
npm test
npm run build
npm run lint
```

## GitHub Actions

This repo now includes:

- `.github/workflows/ci.yml`
  - installs dependencies
  - generates Prisma client
  - runs lint, tests, build
  - verifies the Docker image builds

- `.github/workflows/docker-image.yml`
  - builds and pushes the image to `ghcr.io/<owner>/<repo>`
  - runs on `main` / `master`, tags, and manual dispatch

For Hamravesh, the usual setup is:

1. Connect the GitHub repository in Hamravesh.
2. Use the included `Dockerfile` as the container build source, or point Hamravesh to the GHCR image published by GitHub Actions.
3. Set runtime environment variables in Hamravesh:
   - `DATABASE_URL`
   - `BRS_API_KEY`
   - `BRS_BASE_URL`
   - any optional analysis config overrides

If Hamravesh pulls from GHCR, make sure the platform has permission to read the package or use a public package visibility setting.

Included test coverage:

- SMA and EMA calculation
- Stoch RSI calculation and cross detection
- Price trend classification
- Regime classification
- Composite scoring and action priority
- Persian semantic generation
- Safe number parsing
- API response shape

## Disclaimer

This output is not financial advice. It is only the deterministic output of a historical-data analysis system for a single symbol.
