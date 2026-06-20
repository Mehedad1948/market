import { env } from '../config/env';
import { logger } from '../lib/logger';
import { analysisCacheRepository } from '../repositories/analysisCache.repository';
import { symbolRepository } from '../repositories/symbol.repository';

const subtractDays = (days: number, now: Date): Date => {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

let activeCleanup: Promise<void> | null = null;

const runCleanup = async () => {
  const now = new Date();
  const analysisCacheCutoff = subtractDays(
    env.ANALYSIS_CACHE_RETENTION_DAYS,
    now
  );
  const analysisRequestCutoff = subtractDays(
    env.ANALYSIS_REQUEST_RETENTION_DAYS,
    now
  );

  const [expiredCache, oldCache, oldRequests] = await Promise.all([
    analysisCacheRepository.deleteExpired(now),
    analysisCacheRepository.deleteOlderThan(analysisCacheCutoff),
    symbolRepository.deleteAnalysisRequestsOlderThan(analysisRequestCutoff)
  ]);

  logger.info(
    {
      expiredCacheDeleted: expiredCache.count,
      oldCacheDeleted: oldCache.count,
      oldAnalysisRequestsDeleted: oldRequests.count,
      analysisCacheRetentionDays: env.ANALYSIS_CACHE_RETENTION_DAYS,
      analysisRequestRetentionDays: env.ANALYSIS_REQUEST_RETENTION_DAYS
    },
    'Analysis storage cleanup completed'
  );
};

export const maintenanceService = {
  async cleanupAnalysisStorage() {
    if (activeCleanup) {
      return activeCleanup;
    }

    activeCleanup = runCleanup().finally(() => {
      activeCleanup = null;
    });

    return activeCleanup;
  }
};
