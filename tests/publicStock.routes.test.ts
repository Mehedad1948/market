import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const stockControllerMocks = vi.hoisted(() => ({
  getStockAnalysis: vi.fn((request, response) => {
    response.status(200).json({
      status: 'OK',
      symbol: request.params.symbol,
      public: true
    });
  }),
  getLatestAnalyses: vi.fn(),
  getSignalScanStatus: vi.fn(),
  getLatestStockMetric: vi.fn(),
  getStockHistory: vi.fn(),
  runManualSignalScan: vi.fn(),
  refreshStockHistory: vi.fn()
}));

const backtestControllerMocks = vi.hoisted(() => ({
  runBacktest: vi.fn(),
  compareBacktests: vi.fn(),
  getBacktestReport: vi.fn()
}));

vi.mock('../src/controllers/stock.controller', () => stockControllerMocks);
vi.mock('../src/controllers/backtest.controller', () => backtestControllerMocks);

import { createApp } from '../src/app';

describe('public stock routes', () => {
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
  });

  it('returns stock analysis from the public alias without authentication', async () => {
    const response = await fetch(`${baseUrl}/api/public/stocks/FMLI/analysis`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      symbol: 'FMLI',
      public: true
    });
    expect(stockControllerMocks.getStockAnalysis).toHaveBeenCalledTimes(1);
  });
});
