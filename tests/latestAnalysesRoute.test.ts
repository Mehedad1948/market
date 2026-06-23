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
        persianSummary: 'sample summary',
        result: {
          status: 'OK',
          symbol: 'TEST',
          source: 'database',
          cacheHit: true,
          latestDataDate: '1403-01-01',
          windows: {
            weekly: 7,
            monthly: 30,
            quarterly: 90
          },
          metrics: {
            latestTradeValue: 1000,
            latestClosePrice: 1234,
            latestClosePriceChangePercent: 1.25,
            maWeekly: 900,
            maMonthly: 850,
            maQuarterly: 800,
            weeklySlope: 1,
            monthlySlope: 1,
            quarterlySlope: 1,
            valueChangeVsMonthly: 0.1,
            valueChangeVsQuarterly: 0.2,
            relativeTradeValue20: 1.1,
            liquidityExpansion: false,
            liquidityContraction: false
          },
          signals: {
            composite: {
              action: {
                label: 'Hold',
                value: 'HOLD'
              },
              score: 10,
              bias: {
                label: 'Neutral',
                value: 'NEUTRAL'
              },
              entryTiming: {
                label: 'Not ready',
                value: 'NOT_READY'
              },
              explanationKey: 'composite.hold',
              scoreScale: {
                min: -100,
                max: 100
              },
              timeframes: {
                shortTerm: {
                  score: 0,
                  action: {
                    label: 'Hold',
                    value: 'HOLD'
                  },
                  quality: {
                    label: 'Neutral',
                    value: 'NEUTRAL'
                  },
                  decision: {
                    buy: { label: 'No', value: false },
                    sell: { label: 'No', value: false },
                    hold: { label: 'Yes', value: true },
                    wait: { label: 'No', value: false },
                    caution: { label: 'No', value: false },
                    reduce: { label: 'No', value: false },
                    exit: { label: 'No', value: false }
                  },
                  positionAdvice: {
                    forNewPosition: {
                      label: 'Wait',
                      value: 'WAIT'
                    },
                    forExistingPosition: {
                      label: 'Hold',
                      value: 'HOLD'
                    }
                  },
                  explanationKey: 'short.hold'
                },
                midTerm: {
                  score: 0,
                  action: {
                    label: 'Hold',
                    value: 'HOLD'
                  },
                  quality: {
                    label: 'Neutral',
                    value: 'NEUTRAL'
                  },
                  decision: {
                    buy: { label: 'No', value: false },
                    sell: { label: 'No', value: false },
                    hold: { label: 'Yes', value: true },
                    wait: { label: 'No', value: false },
                    caution: { label: 'No', value: false },
                    reduce: { label: 'No', value: false },
                    exit: { label: 'No', value: false }
                  },
                  positionAdvice: {
                    forNewPosition: {
                      label: 'Wait',
                      value: 'WAIT'
                    },
                    forExistingPosition: {
                      label: 'Hold',
                      value: 'HOLD'
                    }
                  },
                  explanationKey: 'mid.hold'
                },
                longTerm: {
                  score: 0,
                  action: {
                    label: 'Hold',
                    value: 'HOLD'
                  },
                  quality: {
                    label: 'Neutral',
                    value: 'NEUTRAL'
                  },
                  decision: {
                    buy: { label: 'No', value: false },
                    sell: { label: 'No', value: false },
                    hold: { label: 'Yes', value: true },
                    wait: { label: 'No', value: false },
                    caution: { label: 'No', value: false },
                    reduce: { label: 'No', value: false },
                    exit: { label: 'No', value: false }
                  },
                  positionAdvice: {
                    forNewPosition: {
                      label: 'Wait',
                      value: 'WAIT'
                    },
                    forExistingPosition: {
                      label: 'Hold',
                      value: 'HOLD'
                    }
                  },
                  explanationKey: 'long.hold'
                }
              }
            }
          },
          persianSummary: 'sample summary',
          disclaimer: 'not advice'
        }
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

  it('returns only composite when includeResult=true', async () => {
    const response = await fetch(
      `${baseUrl}/api/stocks/analyses/latest?limit=20&includeResult=true`
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
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
          composite: {
            action: {
              label: 'Hold',
              value: 'HOLD'
            },
            score: 10,
            bias: {
              label: 'Neutral',
              value: 'NEUTRAL'
            },
            entryTiming: {
              label: 'Not ready',
              value: 'NOT_READY'
            }
          }
        }
      ]
    });
    expect(body.items[0].result).toBeUndefined();
    expect(body.items[0].metrics).toBeUndefined();
    expect(getLatestAnalyses).toHaveBeenCalledWith(
      'hash-latest',
      20,
      0,
      expect.any(Date),
      true
    );
  });
});
