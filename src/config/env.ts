import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  BRS_API_KEY: z.string().min(1),
  BRS_BASE_URL: z.string().url(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  HISTORY_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
  DEFAULT_WEEKLY_WINDOW: z.coerce.number().int().positive().default(7),
  DEFAULT_MONTHLY_WINDOW: z.coerce.number().int().positive().default(30),
  DEFAULT_QUARTERLY_WINDOW: z.coerce.number().int().positive().default(90),
  BUY_THRESHOLD_PERCENT: z.coerce.number().positive().default(0.02),
  STOCH_RSI_RSI_LENGTH: z.coerce.number().int().positive().default(14),
  STOCH_RSI_STOCH_LENGTH: z.coerce.number().int().positive().default(14),
  STOCH_RSI_K_SMOOTH: z.coerce.number().int().positive().default(5),
  STOCH_RSI_D_SMOOTH: z.coerce.number().int().positive().default(5),
  STOCH_RSI_UPPER: z.coerce.number().min(0).max(100).default(80),
  STOCH_RSI_LOWER: z.coerce.number().min(0).max(100).default(20),
  STOCH_RSI_SELL_LOOKBACK: z.coerce.number().int().positive().default(12),
  STOCH_RSI_BUY_LOOKBACK: z.coerce.number().int().positive().default(6),
  STOCH_RSI_SIGNAL_MAX_AGE: z.coerce.number().int().nonnegative().default(3),
  STOCH_RSI_MIN_CROSS_DISTANCE: z.coerce.number().nonnegative().default(1),
  PRICE_FAST_MA_WINDOW: z.coerce.number().int().positive().default(20),
  PRICE_MID_MA_WINDOW: z.coerce.number().int().positive().default(50),
  PRICE_LONG_MA_WINDOW: z.coerce.number().int().positive().default(200),
  PRICE_MA_TYPE: z
    .preprocess(
      (value) =>
        String(value ?? 'EMA')
          .trim()
          .toUpperCase() === 'EMA'
          ? 'EMA'
          : 'SMA',
      z.enum(['EMA', 'SMA'])
    )
    .default('EMA'),
  PRICE_TREND_MIN_SLOPE: z.coerce.number().default(0),
  ATR_PERIOD: z.coerce.number().int().positive().default(14),
  ATR_LOW_VOLATILITY_THRESHOLD: z.coerce.number().positive().default(0.015),
  ATR_HIGH_VOLATILITY_THRESHOLD: z.coerce.number().positive().default(0.05),
  ADX_PERIOD: z.coerce.number().int().positive().default(14),
  LIQUIDITY_CONFIRMATION_WINDOW: z.coerce.number().int().positive().default(20),
  LIQUIDITY_EXPANSION_THRESHOLD: z.coerce.number().positive().default(1.5),
  LIQUIDITY_CONTRACTION_THRESHOLD: z.coerce.number().positive().default(0.7),
  SIGNAL_SCAN_ENABLED: z.coerce.boolean().default(true),
  SIGNAL_SCAN_CRON: z.string().min(1).default('0 16 * * 0-4'),
  SIGNAL_SCAN_TIMEZONE: z.string().min(1).default('Asia/Tehran'),
  SIGNAL_SCAN_SYMBOLS: z.string().default(''),
  SIGNAL_SCAN_FORCE_REFRESH: z.coerce.boolean().default(false),
  SIGNAL_SCAN_INCLUDE_REAL_LEGAL: z.coerce.boolean().default(false),
  COMPOSITE_SCORING_VERSION: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables', parsed.error.flatten());
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
