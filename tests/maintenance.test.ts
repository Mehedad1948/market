import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteExpired,
  deleteOlderThan,
  deleteAnalysisRequestsOlderThan,
  loggerInfo
} = vi.hoisted(() => ({
  deleteExpired: vi.fn(),
  deleteOlderThan: vi.fn(),
  deleteAnalysisRequestsOlderThan: vi.fn(),
  loggerInfo: vi.fn()
}));

vi.mock('../src/repositories/analysisCache.repository', () => ({
  analysisCacheRepository: {
    deleteExpired,
    deleteOlderThan
  }
}));

vi.mock('../src/repositories/symbol.repository', () => ({
  symbolRepository: {
    deleteAnalysisRequestsOlderThan
  }
}));

vi.mock('../src/lib/logger', () => ({
  logger: {
    info: loggerInfo
  }
}));

import { maintenanceService } from '../src/services/maintenance.service';

describe('maintenance.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteExpired.mockResolvedValue({ count: 2 });
    deleteOlderThan.mockResolvedValue({ count: 3 });
    deleteAnalysisRequestsOlderThan.mockResolvedValue({ count: 4 });
  });

  it('cleanup deletes expired AnalysisCache rows', async () => {
    await maintenanceService.cleanupAnalysisStorage();

    expect(deleteExpired).toHaveBeenCalledTimes(1);
  });

  it('cleanup deletes old AnalysisRequest rows', async () => {
    await maintenanceService.cleanupAnalysisStorage();

    expect(deleteAnalysisRequestsOlderThan).toHaveBeenCalledTimes(1);
  });

  it('cleanup logs deleted counts', async () => {
    await maintenanceService.cleanupAnalysisStorage();

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        expiredCacheDeleted: 2,
        oldCacheDeleted: 3,
        oldAnalysisRequestsDeleted: 4
      }),
      'Analysis storage cleanup completed'
    );
  });
});
