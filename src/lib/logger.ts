import pino from 'pino';

import { env } from '../config/env';

export const maskSecret = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  if (value.length <= 6) {
    return `${value[0] ?? '*'}***${value.at(-1) ?? '*'}`;
  }

  return `${value.slice(0, 3)}***${value.slice(-2)}`;
};

export const buildEnvDiagnostics = () => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrlConfigured: Boolean(env.DATABASE_URL),
  databaseUrlProtocol: env.DATABASE_URL.split(':')[0] ?? null,
  brsBaseUrl: env.BRS_BASE_URL,
  brsApiKeyConfigured: Boolean(env.BRS_API_KEY),
  brsApiKeyPreview: maskSecret(env.BRS_API_KEY),
  cacheTtlSeconds: env.CACHE_TTL_SECONDS,
  historyMaxAgeHours: env.HISTORY_MAX_AGE_HOURS,
  dbOperationTimeoutMs: env.DB_OPERATION_TIMEOUT_MS,
  signalScanEnabled: env.SIGNAL_SCAN_ENABLED,
  signalScanCron: env.SIGNAL_SCAN_CRON,
  signalScanTimezone: env.SIGNAL_SCAN_TIMEZONE,
  signalScanSymbolDelayMs: env.SIGNAL_SCAN_SYMBOL_DELAY_MS
});

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      })
});
