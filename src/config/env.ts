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
  DEFAULT_WEEKLY_WINDOW: z.coerce.number().int().positive().default(7),
  DEFAULT_MONTHLY_WINDOW: z.coerce.number().int().positive().default(30),
  DEFAULT_QUARTERLY_WINDOW: z.coerce.number().int().positive().default(90),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
