import type { AddressInfo } from 'node:net';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

const { getLatestAnalyses, analyzeSymbolMetrics, cleanupAnalysisStorage } =
  vi.hoisted(() => ({
    getLatestAnalyses: vi.fn(),
    analyzeSymbolMetrics: vi.fn(),
    cleanupAnalysisStorage: vi.fn().mockResolvedValue(undefined)
  }));

vi.mock('../src/repositories/analysisCache.repository', () => ({
  analysisCacheRepository: {
    getLatestAnalyses,
    getActiveCache: vi.fn(),
    saveCache: vi.fn(),
    deleteExpired: vi.fn(),
    deleteOlderThan: vi.fn()
  }
}));

vi.mock('../src/services/analysis.service', () => ({
  buildAnalysisParamsHash: vi.fn(() => 'hash-latest'),
  analyzeSymbolMetrics,
  InsufficientDataError: class InsufficientDataError extends Error {}
}));

vi.mock('../src/services/maintenance.service', () => ({
  maintenanceService: {
    cleanupAnalysisStorage
  }
}));

import { createApp } from '../src/app';

describe('latest analyses route', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = '';

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupAnalysisStorage.mockResolvedValue(undefined);
    getLatestAnalyses.mockResolvedValue([
      {
        symbol: 'TEST',
        latestDataDate: '1403-01-01',
        analyzedAt: new Date('2026-06-21T09:00:00.000Z'),
        expiresAt: new Date('2026-06-21T10:00:00.000Z'),
        action: 'HOLD',
        score: 10,
        bias: 'NEUTRAL',
        entryTiming: 'NOT_READY',
        latestClosePrice: 1234,
        latestClosePriceChangePercent: 1.25,
        persianSummary: 'sample summary'
      }
    ]);
  });

  it('returns lightweight cached analyses without computing analysis', async () => {
    const response = await fetch(
      `${baseUrl}/api/stocks/analyses/latest?limit=20`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      limit: 20,
      offset: 0,
      items: [
        {
          symbol: 'TEST',
          latestDataDate: '1403-01-01',
          action: 'HOLD',
          score: 10,
          bias: 'NEUTRAL',
          entryTiming: 'NOT_READY',
          latestClosePrice: 1234,
          latestClosePriceChangePercent: 1.25,
          persianSummary: 'sample summary'
        }
      ]
    });
    expect(getLatestAnalyses).toHaveBeenCalledWith(
      'hash-latest',
      20,
      0,
      expect.any(Date),
      false
    );
    expect(analyzeSymbolMetrics).not.toHaveBeenCalled();
  });
});
