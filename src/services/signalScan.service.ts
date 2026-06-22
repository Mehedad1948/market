import cron, { type ScheduledTask } from 'node-cron';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { analysisCacheRepository } from '../repositories/analysisCache.repository';
import { symbolRepository } from '../repositories/symbol.repository';
import type { StockAnalysisResult, SymbolAnalysisParams } from '../types';
import { telegramNotifier } from './telegramNotifier.service';
import {
  InsufficientDataError,
  analyzeSymbolMetrics,
  buildAnalysisParamsHash
} from './analysis.service';
import { symbolDataService } from './symbolData.service';

const parseSymbolList = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

const buildScanParams = (
  forceRefresh: boolean,
  includeRealLegal: boolean
): SymbolAnalysisParams => {
  return {
    weeklyWindow: env.DEFAULT_WEEKLY_WINDOW,
    monthlyWindow: env.DEFAULT_MONTHLY_WINDOW,
    quarterlyWindow: env.DEFAULT_QUARTERLY_WINDOW,
    forceRefresh,
    includeRealLegal
  };
};

const buildSource = (forceRefresh: boolean): 'database' | 'brsapi' => {
  return forceRefresh ? 'brsapi' : 'database';
};

const buildWatchlist = async (symbols?: string[]): Promise<string[]> => {
  if (symbols && symbols.length > 0) {
    return symbols;
  }

  const envSymbols = parseSymbolList(env.SIGNAL_SCAN_SYMBOLS);
  if (envSymbols.length > 0) {
    return envSymbols;
  }

  return symbolRepository.getTrackedSymbols();
};

export class ScanAlreadyRunningError extends Error {
  constructor() {
    super('A signal scan is already running.');
    this.name = 'ScanAlreadyRunningError';
  }
}

export type SignalScanItem = {
  symbol: string;
  status: 'OK' | 'INSUFFICIENT_DATA' | 'ERROR';
  action: string | null;
  score: number | null;
  latestDataDate: string | null;
  reason?: string;
};

export type SignalScanSummary = {
  status: 'OK';
  scannedAt: string;
  symbolsRequested: number;
  scannedCount: number;
  okCount: number;
  insufficientDataCount: number;
  errorCount: number;
  results: SignalScanItem[];
};

export type SignalScanRuntimeStatus = {
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastTriggeredAt: string | null;
  lastOutcome: 'SUCCESS' | 'ERROR' | 'NEVER_RAN';
  lastScannedAt: string | null;
  lastSymbolsRequested: number | null;
  lastScannedCount: number | null;
  lastOkCount: number | null;
  lastInsufficientDataCount: number | null;
  lastErrorCount: number | null;
  lastError: string | null;
  currentPhase:
    | 'IDLE'
    | 'BUILD_WATCHLIST'
    | 'REFRESH_SYMBOL_HISTORY'
    | 'LOAD_SYMBOL_HISTORY'
    | 'CHECK_CACHE'
    | 'ANALYZE_SYMBOL'
    | 'SAVE_CACHE'
    | 'WAIT_SYMBOL_DELAY';
  currentPhaseStartedAt: string | null;
  currentSymbol: string | null;
  currentSymbolIndex: number | null;
  symbolsTotal: number | null;
  symbolsCompleted: number | null;
  currentSymbolStartedAt: string | null;
};

export type SignalScanScheduleStatus = {
  enabled: boolean;
  cron: string;
  timezone: string;
  isRegistered: boolean;
  taskStatus: string | null;
  nextRunAt: string | null;
  serverTime: string;
  timezoneLocalTime: string;
};

let activeScanPromise: Promise<SignalScanSummary> | null = null;
let scanRuntimeStatus: SignalScanRuntimeStatus = {
  isRunning: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastTriggeredAt: null,
  lastOutcome: 'NEVER_RAN',
  lastScannedAt: null,
  lastSymbolsRequested: null,
  lastScannedCount: null,
  lastOkCount: null,
  lastInsufficientDataCount: null,
  lastErrorCount: null,
  lastError: null,
  currentPhase: 'IDLE',
  currentPhaseStartedAt: null,
  currentSymbol: null,
  currentSymbolIndex: null,
  symbolsTotal: null,
  symbolsCompleted: null,
  currentSymbolStartedAt: null
};

const updateRuntimeProgress = (
  patch: Partial<SignalScanRuntimeStatus>
): void => {
  scanRuntimeStatus = {
    ...scanRuntimeStatus,
    ...patch
  };
};

const formatTimeInZone = (date: Date, timezone: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
};

const getTaskStatus = (task: ScheduledTask | null): string | null => {
  if (!task) {
    return null;
  }

  const candidate = task as ScheduledTask & {
    getStatus?: () => string;
  };

  return typeof candidate.getStatus === 'function'
    ? candidate.getStatus()
    : 'UNKNOWN';
};

const getTaskNextRunAt = (task: ScheduledTask | null): string | null => {
  if (!task) {
    return null;
  }

  const candidate = task as ScheduledTask & {
    getNextRun?: () => Date | null;
  };

  if (typeof candidate.getNextRun !== 'function') {
    return null;
  }

  const nextRun = candidate.getNextRun();
  return nextRun ? nextRun.toISOString() : null;
};

const runScanInternal = async (options?: {
  symbols?: string[];
  forceRefresh?: boolean;
  includeRealLegal?: boolean;
}): Promise<SignalScanSummary> => {
  const forceRefresh = options?.forceRefresh ?? env.SIGNAL_SCAN_FORCE_REFRESH;
  const includeRealLegal =
    options?.includeRealLegal ?? env.SIGNAL_SCAN_INCLUDE_REAL_LEGAL;

  updateRuntimeProgress({
    currentPhase: 'BUILD_WATCHLIST',
    currentPhaseStartedAt: new Date().toISOString()
  });

  const symbols = await buildWatchlist(options?.symbols);
  const params = buildScanParams(forceRefresh, includeRealLegal);
  const paramsHash = buildAnalysisParamsHash(params);
  const results: SignalScanItem[] = [];

  updateRuntimeProgress({
    symbolsTotal: symbols.length,
    symbolsCompleted: 0
  });

  for (const [index, symbol] of symbols.entries()) {
    updateRuntimeProgress({
      currentSymbol: symbol,
      currentSymbolIndex: index + 1,
      currentSymbolStartedAt: new Date().toISOString()
    });

    try {
      if (forceRefresh) {
        updateRuntimeProgress({
          currentPhase: 'REFRESH_SYMBOL_HISTORY',
          currentPhaseStartedAt: new Date().toISOString()
        });
        await symbolDataService.refreshSymbolHistory(symbol, includeRealLegal);
      }

      updateRuntimeProgress({
        currentPhase: 'LOAD_SYMBOL_HISTORY',
        currentPhaseStartedAt: new Date().toISOString()
      });
      const history = await symbolRepository.getSymbolHistory(symbol);
      const latestDataDate = history.at(-1)?.date ?? null;

      if (!forceRefresh && latestDataDate) {
        updateRuntimeProgress({
          currentPhase: 'CHECK_CACHE',
          currentPhaseStartedAt: new Date().toISOString()
        });
        const activeCache = await analysisCacheRepository.getActiveCache(
          symbol,
          paramsHash,
          latestDataDate
        );

        if (activeCache && activeCache.expiresAt > new Date()) {
          const cachedResult = activeCache.result as StockAnalysisResult;

          results.push({
            symbol,
            status: 'OK',
            action: cachedResult.signals.composite.action.value,
            score: cachedResult.signals.composite.score,
            latestDataDate: cachedResult.latestDataDate
          });
          logger.info(
            {
              symbol,
              action: cachedResult.signals.composite.action.value,
              score: cachedResult.signals.composite.score,
              latestDataDate: cachedResult.latestDataDate
            },
            'Signal scan cache hit'
          );
        } else {
          updateRuntimeProgress({
            currentPhase: 'ANALYZE_SYMBOL',
            currentPhaseStartedAt: new Date().toISOString()
          });
          const result = analyzeSymbolMetrics(
            symbol,
            history,
            params,
            buildSource(forceRefresh),
            false
          );
          const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000);

          updateRuntimeProgress({
            currentPhase: 'SAVE_CACHE',
            currentPhaseStartedAt: new Date().toISOString()
          });
          await analysisCacheRepository.saveCache(
            symbol,
            paramsHash,
            result.latestDataDate,
            result,
            expiresAt
          );

          results.push({
            symbol,
            status: 'OK',
            action: result.signals.composite.action.value,
            score: result.signals.composite.score,
            latestDataDate: result.latestDataDate
          });
          logger.info(
            {
              symbol,
              action: result.signals.composite.action.value,
              score: result.signals.composite.score,
              latestDataDate: result.latestDataDate
            },
            'Signal scan completed for symbol'
          );
        }
      } else {
        updateRuntimeProgress({
          currentPhase: 'ANALYZE_SYMBOL',
          currentPhaseStartedAt: new Date().toISOString()
        });
        const result = analyzeSymbolMetrics(
          symbol,
          history,
          params,
          buildSource(forceRefresh),
          false
        );
        const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000);

        updateRuntimeProgress({
          currentPhase: 'SAVE_CACHE',
          currentPhaseStartedAt: new Date().toISOString()
        });
        await analysisCacheRepository.saveCache(
          symbol,
          paramsHash,
          result.latestDataDate,
          result,
          expiresAt
        );

        results.push({
          symbol,
          status: 'OK',
          action: result.signals.composite.action.value,
          score: result.signals.composite.score,
          latestDataDate: result.latestDataDate
        });
        logger.info(
          {
            symbol,
            action: result.signals.composite.action.value,
            score: result.signals.composite.score,
            latestDataDate: result.latestDataDate
          },
          'Signal scan completed for symbol'
        );
      }
    } catch (error) {
      if (error instanceof InsufficientDataError) {
        results.push({
          symbol,
          status: 'INSUFFICIENT_DATA',
          action: null,
          score: null,
          latestDataDate: null,
          reason: error.message
        });
        logger.warn(
          { symbol, err: error },
          'Signal scan skipped: insufficient data'
        );
      } else {
        const message =
          error instanceof Error ? error.message : 'Unknown scan error';
        results.push({
          symbol,
          status: 'ERROR',
          action: null,
          score: null,
          latestDataDate: null,
          reason: message
        });
        logger.error({ symbol, err: error }, 'Signal scan failed for symbol');
      }
    }

    updateRuntimeProgress({
      symbolsCompleted: index + 1
    });

    const hasMoreSymbols = index < symbols.length - 1;
    if (hasMoreSymbols && env.SIGNAL_SCAN_SYMBOL_DELAY_MS > 0) {
      updateRuntimeProgress({
        currentPhase: 'WAIT_SYMBOL_DELAY',
        currentPhaseStartedAt: new Date().toISOString()
      });
      await sleep(env.SIGNAL_SCAN_SYMBOL_DELAY_MS);
    }
  }

  return {
    status: 'OK',
    scannedAt: new Date().toISOString(),
    symbolsRequested: symbols.length,
    scannedCount: results.length,
    okCount: results.filter((item) => item.status === 'OK').length,
    insufficientDataCount: results.filter(
      (item) => item.status === 'INSUFFICIENT_DATA'
    ).length,
    errorCount: results.filter((item) => item.status === 'ERROR').length,
    results
  };
};

export const signalScanService = {
  async runScan(options?: {
    symbols?: string[];
    forceRefresh?: boolean;
    includeRealLegal?: boolean;
  }): Promise<SignalScanSummary> {
    if (activeScanPromise) {
      throw new ScanAlreadyRunningError();
    }

    scanRuntimeStatus = {
      ...scanRuntimeStatus,
      isRunning: true,
      lastStartedAt: new Date().toISOString(),
      lastError: null,
      currentPhase: 'BUILD_WATCHLIST',
      currentPhaseStartedAt: new Date().toISOString(),
      currentSymbol: null,
      currentSymbolIndex: null,
      symbolsTotal: null,
      symbolsCompleted: 0,
      currentSymbolStartedAt: null
    };

    logger.info(
      {
        options: options ?? {},
        schedule: signalScanService.getScheduleStatus()
      },
      'Signal scan run started'
    );

    activeScanPromise = runScanInternal(options)
      .then((summary) => {
        scanRuntimeStatus = {
          ...scanRuntimeStatus,
          isRunning: false,
          lastFinishedAt: new Date().toISOString(),
          lastOutcome: 'SUCCESS',
          lastScannedAt: summary.scannedAt,
          lastSymbolsRequested: summary.symbolsRequested,
          lastScannedCount: summary.scannedCount,
          lastOkCount: summary.okCount,
          lastInsufficientDataCount: summary.insufficientDataCount,
          lastErrorCount: summary.errorCount,
          lastError: null,
          currentPhase: 'IDLE',
          currentPhaseStartedAt: null,
          currentSymbol: null,
          currentSymbolIndex: null,
          symbolsTotal: summary.symbolsRequested,
          symbolsCompleted: summary.scannedCount,
          currentSymbolStartedAt: null
        };

        logger.info(
          {
            scannedAt: summary.scannedAt,
            symbolsRequested: summary.symbolsRequested,
            scannedCount: summary.scannedCount,
            okCount: summary.okCount,
            insufficientDataCount: summary.insufficientDataCount,
            errorCount: summary.errorCount
          },
          'Signal scan run completed'
        );

        void telegramNotifier.send('Signal scan completed', {
          scannedAt: summary.scannedAt,
          symbolsRequested: summary.symbolsRequested,
          scannedCount: summary.scannedCount,
          okCount: summary.okCount,
          insufficientDataCount: summary.insufficientDataCount,
          errorCount: summary.errorCount
        });

        return summary;
      })
      .catch((error: unknown) => {
        scanRuntimeStatus = {
          ...scanRuntimeStatus,
          isRunning: false,
          lastFinishedAt: new Date().toISOString(),
          lastOutcome: 'ERROR',
          lastError: error instanceof Error ? error.message : 'Unknown scan error',
          currentPhase: 'IDLE',
          currentPhaseStartedAt: null,
          currentSymbol: null,
          currentSymbolIndex: null,
          currentSymbolStartedAt: null
        };

        logger.error({ err: error }, 'Signal scan run failed');
        void telegramNotifier.send('Signal scan failed', {
          error: error instanceof Error ? error.message : 'Unknown scan error',
          schedule: signalScanService.getScheduleStatus(),
          runtimeStatus: signalScanService.getRuntimeStatus()
        });

        throw error;
      })
      .finally(() => {
        activeScanPromise = null;
      });

    return activeScanPromise;
  },

  getRuntimeStatus(): SignalScanRuntimeStatus {
    return {
      ...scanRuntimeStatus
    };
  },

  getScheduleStatus(): SignalScanScheduleStatus {
    const now = new Date();

    return {
      enabled: env.SIGNAL_SCAN_ENABLED,
      cron: env.SIGNAL_SCAN_CRON,
      timezone: env.SIGNAL_SCAN_TIMEZONE,
      isRegistered: activeScanTask !== null,
      taskStatus: getTaskStatus(activeScanTask),
      nextRunAt: getTaskNextRunAt(activeScanTask),
      serverTime: now.toISOString(),
      timezoneLocalTime: formatTimeInZone(now, env.SIGNAL_SCAN_TIMEZONE)
    };
  }
};

let activeScanTask: ScheduledTask | null = null;

export const startSignalScanSchedule = () => {
  logger.info(
    signalScanService.getScheduleStatus(),
    'Preparing signal scan scheduler'
  );

  if (!env.SIGNAL_SCAN_ENABLED) {
    logger.info(
      signalScanService.getScheduleStatus(),
      'Signal scan schedule disabled by configuration'
    );
    return null;
  }

  if (activeScanTask) {
    logger.info(
      signalScanService.getScheduleStatus(),
      'Signal scan schedule already registered'
    );
    return activeScanTask;
  }

  activeScanTask = cron.schedule(
    env.SIGNAL_SCAN_CRON,
    async () => {
      scanRuntimeStatus = {
        ...scanRuntimeStatus,
        lastTriggeredAt: new Date().toISOString()
      };

      logger.info(
        signalScanService.getScheduleStatus(),
        'Scheduled signal scan trigger fired'
      );

      void telegramNotifier.send('Scheduled signal scan trigger fired', {
        schedule: signalScanService.getScheduleStatus()
      });

      try {
        const summary = await signalScanService.runScan();

        logger.info(
          {
            scannedAt: summary.scannedAt,
            scannedCount: summary.scannedCount,
            okCount: summary.okCount,
            insufficientDataCount: summary.insufficientDataCount,
            errorCount: summary.errorCount
          },
          'Scheduled signal scan finished successfully'
        );
      } catch (error) {
        if (error instanceof ScanAlreadyRunningError) {
          logger.warn(
            {
              cron: env.SIGNAL_SCAN_CRON,
              runtimeStatus: signalScanService.getRuntimeStatus()
            },
            'Skipping scheduled signal scan because another scan is already running'
          );
          return;
        }

        logger.error({ err: error }, 'Scheduled signal scan crashed');
        void telegramNotifier.send('Scheduled signal scan crashed', {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown scheduled scan error',
          schedule: signalScanService.getScheduleStatus(),
          runtimeStatus: signalScanService.getRuntimeStatus()
        });
        throw error;
      }
    },
    {
      timezone: env.SIGNAL_SCAN_TIMEZONE
    }
  );

  logger.info(
    signalScanService.getScheduleStatus(),
    'Signal scan schedule registered'
  );

  void telegramNotifier.send('Signal scan schedule registered', {
    schedule: signalScanService.getScheduleStatus()
  });

  return activeScanTask;
};
