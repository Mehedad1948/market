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

6. Start development server:

```bash
npm run dev
```

## Environment Variables

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/iran_stock_analysis
BRS_API_KEY=your_key_here
BRS_BASE_URL=https://Api.BrsApi.ir/Tsetmc
CACHE_TTL_SECONDS=86400
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
COMPOSITE_SCORING_VERSION=2
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

## API Endpoints

Sample local requests are available in [requests/localhost.http](/D:/projects/market/requests/localhost.http).

### Health

```bash
curl "http://localhost:3000/health"
```

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

## Analysis Logic

The analysis has three deterministic layers:

- Liquidity/value trend from `SymbolDailyMetric.tradeValue`
- Stoch RSI timing and risk trigger from `SymbolDailyMetric.closePrice`
- Price trend confirmation from `SymbolDailyMetric.closePrice`

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

`signals.composite.score` is clamped to `-100` through `+100`.

| Score range     | Interpretation                         |
| --------------- | -------------------------------------- |
| `+70` to `+100` | Strong bullish / strong buy condition  |
| `+35` to `+69`  | Bullish / probable buy condition       |
| `+10` to `+34`  | Mild bullish / hold with positive bias |
| `-9` to `+9`    | Neutral / mixed                        |
| `-10` to `-34`  | Caution / weak mixed condition         |
| `-35` to `-69`  | Risk sell / reduce risk                |
| `-70` to `-100` | Strong sell / risk-off condition       |

Scoring version 2 uses mutually exclusive Stoch RSI sell penalties:

- `-50` if `stochRsi.confirmedSell`
- otherwise `-25` if `stochRsi.riskSell`

This avoids double-counting confirmed sell as both risk sell and confirmed sell.

## Example Response Shape

```json
{
  "status": "OK",
  "symbol": "فملی",
  "signals": {
    "regime": "STRONG_BULLISH_LIQUIDITY",
    "crossWeeklyAboveMonthly": false,
    "crossWeeklyBelowMonthly": false,
    "crossMonthlyAboveQuarterly": false,
    "crossMonthlyBelowQuarterly": false,
    "confidence": "MEDIUM",
    "buy": {
      "shortTerm": true,
      "midTerm": true,
      "longTerm": true
    },
    "sell": {
      "shortTerm": false,
      "midTerm": false,
      "longTerm": false
    },
    "stochRsi": {
      "status": "OK",
      "latestDate": "1404-03-20",
      "latestK": 17.42,
      "latestD": 12.85,
      "latestZone": "GREEN",
      "upperThreshold": 80,
      "lowerThreshold": 20,
      "crossUpInGreen": true,
      "crossDownInRed": false,
      "redBearishCrossCount": 0,
      "greenBullishCrossCount": 1,
      "barsSinceLastGreenCrossUp": 1,
      "barsSinceLastRedCrossDown": null,
      "probableBuy": true,
      "riskSell": false,
      "confirmedSell": false
    },
    "priceTrend": {
      "status": "OK",
      "latestDate": "1404-03-20",
      "latestClosePrice": 575,
      "fastMa": 540.2,
      "midMa": 498.7,
      "longMa": 421.3,
      "fastSlope": 0.03,
      "midSlope": 0.01,
      "longSlope": 0.004,
      "closeAboveFastMa": true,
      "closeAboveMidMa": true,
      "closeAboveLongMa": true,
      "fastAboveMidMa": true,
      "midAboveLongMa": true,
      "direction": "BULLISH",
      "bullish": true,
      "bearish": false,
      "warning": false
    },
    "composite": {
      "action": "STRONG_BUY",
      "score": 100,
      "explanationKey": "composite.strongBuy",
      "scoreScale": {
        "min": -100,
        "max": 100
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
