import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
      }

      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }

    return value;
  }, z.boolean()).default(defaultValue);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  BRS_API_KEY: z.string().min(1),
  BRS_BASE_URL: z.string().url(),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  ANALYSIS_REQUEST_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  ANALYSIS_CACHE_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  HISTORY_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
  MARKET_HOURS_HISTORY_MAX_AGE_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15),
  MARKET_TIMEZONE: z.string().min(1).default('Asia/Tehran'),
  MARKET_OPEN_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('09:00'),
  MARKET_CLOSE_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('12:30'),
  DEFAULT_WEEKLY_WINDOW: z.coerce.number().int().positive().default(7),
  DEFAULT_MONTHLY_WINDOW: z.coerce.number().int().positive().default(35),
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
  SIGNAL_SCAN_ENABLED: booleanFromEnv(true),
  SIGNAL_SCAN_CRON: z.string().min(1).default('0 22 * * 0-4'),
  SIGNAL_SCAN_TIMEZONE: z.string().min(1).default('Asia/Tehran'),
  SIGNAL_SCAN_SYMBOLS: z.string().default(''),
  SIGNAL_SCAN_FORCE_REFRESH: booleanFromEnv(true),
  SIGNAL_SCAN_INCLUDE_REAL_LEGAL: booleanFromEnv(false),
  SIGNAL_SCAN_SYMBOL_DELAY_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(30000),
  INTERNAL_API_TOKEN: z.string().default(''),
  BALE_BOT_TOKEN: z.string().default(''),
  BALE_BOT_CHAT_ID: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  MAILTRAP_HOST: z.string().default(''),
  MAILTRAP_PORT: z.coerce.number().int().positive().default(587),
  MAILTRAP_USER: z.string().default(''),
  MAILTRAP_PASS: z.string().default(''),
  MAILTRAP_SECURE: booleanFromEnv(false),
  MAILTRAP_FROM_EMAIL: z.string().email().or(z.literal('')).default(''),
  MAILTRAP_FROM_NAME: z.string().default('Market Auth'),
  AUTH_EMAIL_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  AUTH_EMAIL_OTP_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  AUTH_EMAIL_OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  AUTH_EMAIL_OTP_FIXED_CODE: z
    .string()
    .regex(/^\d{4,8}$/)
    .or(z.literal(''))
    .default(''),
  COMPOSITE_SCORING_VERSION: z.coerce.number().int().positive().default(3),
  DB_OPERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables', parsed.error.flatten());
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
