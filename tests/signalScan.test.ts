import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getTrackedSymbols,
  getSymbolHistory,
  getActiveCache,
  saveCache,
  analyzeSymbolMetrics,
  refreshSymbolHistory
} = vi.hoisted(() => ({
  getTrackedSymbols: vi.fn(),
  getSymbolHistory: vi.fn(),
  getActiveCache: vi.fn(),
  saveCache: vi.fn(),
  analyzeSymbolMetrics: vi.fn(),
  refreshSymbolHistory: vi.fn()
}));

vi.mock('../src/repositories/symbol.repository', () => ({
  symbolRepository: {
    getTrackedSymbols,
    getSymbolHistory
  }
}));

vi.mock('../src/repositories/analysisCache.repository', () => ({
  analysisCacheRepository: {
    getActiveCache,
    saveCache
  }
}));

vi.mock('../src/services/analysis.service', () => ({
  buildAnalysisParamsHash: vi.fn(() => 'hash-1'),
  analyzeSymbolMetrics,
  InsufficientDataError: class InsufficientDataError extends Error {}
}));

vi.mock('../src/services/symbolData.service', () => ({
  symbolDataService: {
    refreshSymbolHistory
  }
}));

import {
  ScanAlreadyRunningError,
  signalScanService
} from '../src/services/signalScan.service';

describe('signalScan.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getTrackedSymbols.mockResolvedValue(['TEST']);
    getSymbolHistory.mockResolvedValue([
      {
        date: '1403-01-01'
      }
    ]);
    saveCache.mockResolvedValue({});
    refreshSymbolHistory.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses cache when available and forceRefresh is false', async () => {
    getActiveCache.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      result: {
        latestDataDate: '1403-01-01',
        signals: {
          composite: {
            action: {
              value: 'HOLD'
            },
            score: 12
          }
        }
      }
    });

    const summary = await signalScanService.runScan({
      symbols: ['TEST'],
      forceRefresh: false
    });

    expect(analyzeSymbolMetrics).not.toHaveBeenCalled();
    expect(saveCache).not.toHaveBeenCalled();
    expect(summary.results[0]).toMatchObject({
      symbol: 'TEST',
      action: 'HOLD',
      score: 12,
      latestDataDate: '1403-01-01'
    });
  });

  it('recomputes when cache is missing', async () => {
    getActiveCache.mockResolvedValue(null);
    analyzeSymbolMetrics.mockReturnValue({
      latestDataDate: '1403-01-01',
      signals: {
        composite: {
          action: {
            value: 'PROBABLE_BUY'
          },
          score: 33
        }
      }
    });

    const summary = await signalScanService.runScan({
      symbols: ['TEST'],
      forceRefresh: false
    });

    expect(analyzeSymbolMetrics).toHaveBeenCalledTimes(1);
    expect(saveCache).toHaveBeenCalledTimes(1);
    expect(summary.results[0]).toMatchObject({
      action: 'PROBABLE_BUY',
      score: 33
    });
  });

  it('recomputes when cache is expired', async () => {
    getActiveCache.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      result: {
        latestDataDate: '1403-01-01',
        signals: {
          composite: {
            action: {
              value: 'HOLD'
            },
            score: 12
          }
        }
      }
    });
    analyzeSymbolMetrics.mockReturnValue({
      latestDataDate: '1403-01-01',
      signals: {
        composite: {
          action: {
            value: 'CAUTION'
          },
          score: -5
        }
      }
    });

    const summary = await signalScanService.runScan({
      symbols: ['TEST'],
      forceRefresh: false
    });

    expect(analyzeSymbolMetrics).toHaveBeenCalledTimes(1);
    expect(saveCache).toHaveBeenCalledTimes(1);
    expect(summary.results[0]).toMatchObject({
      action: 'CAUTION',
      score: -5
    });
  });

  it('rejects overlapping scans', async () => {
    let releaseHistory: (() => void) | null = null;

    getActiveCache.mockResolvedValue(null);
    getSymbolHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseHistory = () => resolve([{ date: '1403-01-01' }]);
        })
    );
    analyzeSymbolMetrics.mockReturnValue({
      latestDataDate: '1403-01-01',
      signals: {
        composite: {
          action: {
            value: 'HOLD'
          },
          score: 5
        }
      }
    });

    const firstRun = signalScanService.runScan({
      symbols: ['TEST'],
      forceRefresh: false
    });

    await expect(
      signalScanService.runScan({
        symbols: ['TEST'],
        forceRefresh: false
      })
    ).rejects.toBeInstanceOf(ScanAlreadyRunningError);

    releaseHistory?.();
    await firstRun;
  });

  it('waits between symbols based on configured delay', async () => {
    vi.useFakeTimers();
    getTrackedSymbols.mockResolvedValue(['AAA', 'BBB']);
    getActiveCache.mockResolvedValue(null);
    analyzeSymbolMetrics.mockReturnValue({
      latestDataDate: '1403-01-01',
      signals: {
        composite: {
          action: {
            value: 'PROBABLE_BUY'
          },
          score: 21
        }
      }
    });

    const pending = signalScanService.runScan({
      symbols: ['AAA', 'BBB'],
      forceRefresh: false
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(analyzeSymbolMetrics).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(analyzeSymbolMetrics).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(analyzeSymbolMetrics).toHaveBeenCalledTimes(2);
  });
});
