# Iran Stock Analysis API

Backend-only Express.js API for analyzing **individual Iran stock symbols** such as `فملی`, `خودرو`, and `شپنا` using BrsApi historical data. This project does **not** implement total market or index analysis. All logic is per-symbol and centered on daily traded value (`tval` / ارزش معاملات روزانه).

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
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

## Docker Compose

```bash
docker compose up -d
docker compose down
docker compose logs -f postgres
```

## Prisma Commands

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

## API Endpoints

Sample local requests are available in [requests/localhost.http](/D:/projects/market/requests/localhost.http). You can run them with the VS Code REST Client extension, JetBrains HTTP Client, or any editor that supports `.http` request files.

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

### History

```bash
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/history?limit=50&offset=0"
```

### Latest Stored Metric

```bash
curl "http://localhost:3000/api/stocks/%D9%81%D9%85%D9%84%DB%8C/latest"
```

## Analysis Logic

The analysis uses `tval` as daily traded value and computes:

- Weekly SMA: `SMA(tval, 7)`
- Monthly SMA: `SMA(tval, 30)`
- Quarterly SMA: `SMA(tval, 90)`
- Slopes for weekly, monthly, and quarterly SMA series
- Weekly/monthly and monthly/quarterly crossover signals
- Technical/liquidity-based buy timeframes:
  - `shortTerm`: `maWeekly` is above `maMonthly` by at least `BUY_THRESHOLD_PERCENT`, `weeklySlope > 0`, and `latestTradeValue > maWeekly`
  - `midTerm`: `maMonthly` is above `maQuarterly` by at least `BUY_THRESHOLD_PERCENT`, `monthlySlope > 0`, and `latestTradeValue > maMonthly`
  - `longTerm`: `quarterlySlope > 0`, `maMonthly > maQuarterly`, and `latestTradeValue > maQuarterly`

Regimes:

- `STRONG_BULLISH_LIQUIDITY`: `maWeekly > maMonthly > maQuarterly` and `monthlySlope > 0`
- `EARLY_BULLISH`: weekly MA crosses above monthly MA while monthly MA is not above quarterly MA
- `CONFIRMED_BULLISH`: monthly MA crosses above quarterly MA
- `SHORT_TERM_WARNING`: weekly MA crosses below monthly MA
- `BEARISH_LIQUIDITY`: `maWeekly < maMonthly < maQuarterly` and `monthlySlope < 0`
- `NEUTRAL`: all other cases

Example `signals` payload:

```json
{
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
  }
}
```

## Behavior Notes

- BRS dates are stored as strings to avoid Jalali conversion bugs.
- Historical analysis is always done from normalized rows in PostgreSQL.
- Real/legal history is optional and does not block main analysis.
- Cache keys use `symbol + paramsHash + latestDataDate`.
- Every analysis request is logged in `AnalysisRequest`.
- `signals.buy` describes liquidity-based technical conditions and is **not** a direct trade recommendation.

## Testing

```bash
npm test
```

Included test coverage:

- SMA calculation
- Crossover detection
- Regime classification
- Persian semantic generation
- Safe number parsing
- Buy timeframe calculation and response shape

## Warning

This output is **not financial advice**. It only describes liquidity behavior and traded-value structure for a single symbol based on historical data.
