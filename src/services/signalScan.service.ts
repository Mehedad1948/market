import cron, { type ScheduledTask } from 'node-cron';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { analysisCacheRepository } from '../repositories/analysisCache.repository';
import { symbolRepository } from '../repositories/symbol.repository';
import type { StockAnalysisResult, SymbolAnalysisParams } from '../types';
import {
  analyzeSymbolMetrics,
  buildAnalysisParamsHash,
  InsufficientDataError
} from './analysis.service';
import { symbolDataService } from './symbolData.service';

const parseSymbolList = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

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

export const signalScanService = {
  async runScan(options?: {
    symbols?: string[];
    forceRefresh?: boolean;
    includeRealLegal?: boolean;
  }): Promise<SignalScanSummary> {
    const forceRefresh = options?.forceRefresh ?? env.SIGNAL_SCAN_FORCE_REFRESH;
    const includeRealLegal =
      options?.includeRealLegal ?? env.SIGNAL_SCAN_INCLUDE_REAL_LEGAL;
    const symbols = await buildWatchlist(options?.symbols);
    const params = buildScanParams(forceRefresh, includeRealLegal);
    const paramsHash = buildAnalysisParamsHash(params);
    const results: SignalScanItem[] = [];

    for (const symbol of symbols) {
      try {
        if (forceRefresh) {
          await symbolDataService.refreshSymbolHistory(symbol, includeRealLegal);
        }

        const history = await symbolRepository.getSymbolHistory(symbol);
        const latestDataDate = history.at(-1)?.date ?? null;

        if (!forceRefresh && latestDataDate) {
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
            continue;
          }
        }

        const result = analyzeSymbolMetrics(
          symbol,
          history,
          params,
          buildSource(forceRefresh),
          false
        );
        const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000);

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
          logger.warn({ symbol, err: error }, 'Signal scan skipped: insufficient data');
          continue;
        }

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
  }
};

let activeScanTask: ScheduledTask | null = null;

export const startSignalScanSchedule = () => {
  if (!env.SIGNAL_SCAN_ENABLED) {
    logger.info('Signal scan schedule disabled by configuration');
    return null;
  }

  if (activeScanTask) {
    return activeScanTask;
  }

  activeScanTask = cron.schedule(
    env.SIGNAL_SCAN_CRON,
    async () => {
      logger.info(
        {
          cron: env.SIGNAL_SCAN_CRON,
          timezone: env.SIGNAL_SCAN_TIMEZONE
        },
        'Starting scheduled signal scan'
      );
      await signalScanService.runScan();
    },
    {
      timezone: env.SIGNAL_SCAN_TIMEZONE
    }
  );

  logger.info(
    {
      cron: env.SIGNAL_SCAN_CRON,
      timezone: env.SIGNAL_SCAN_TIMEZONE
    },
    'Signal scan schedule registered'
  );

  return activeScanTask;
};
