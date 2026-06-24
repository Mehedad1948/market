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

const { runBacktest, getReport, compareBacktests } = vi.hoisted(() => ({
  runBacktest: vi.fn(),
  getReport: vi.fn(),
  compareBacktests: vi.fn()
}));

vi.mock('../src/services/backtest.service', () => ({
  backtestService: {
    runBacktest,
    getReport,
    compareBacktests
  }
}));

import { createApp } from '../src/app';
import { backtestService } from '../src/services/backtest.service';

describe('backtest routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = '';

  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1');
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
    runBacktest.mockResolvedValue({
      status: 'OK',
      run: {
        id: 'run-1',
        status: 'COMPLETED',
        snapshotCount: 10
      }
    });
    getReport.mockResolvedValue({
      status: 'OK',
      run: {
        id: 'run-1',
        status: 'COMPLETED'
      },
      report: {
        sampleCount: 10
      }
    });
    compareBacktests.mockResolvedValue({
      status: 'OK',
      symbol: 'TEST',
      comparisonCount: 2,
      variants: [
        {
          key: 'full_composite',
          run: { id: 'run-1' },
          report: { sampleCount: 10 }
        }
      ]
    });
  });

  it('runs a backtest with cleaned symbols and window options', async () => {
    const response = await fetch(`${baseUrl}/api/stocks/backtests/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbols: [' TEST ', ''],
        dateFrom: '1402-01-01',
        maxSnapshotsPerSymbol: 20,
        weeklyWindow: 7,
        monthlyWindow: 30,
        quarterlyWindow: 90,
        indicatorMode: 'stochRsi_only',
        disabledIndicators: ['atr']
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      run: {
        id: 'run-1'
      }
    });
    expect(backtestService.runBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['TEST'],
        dateFrom: '1402-01-01',
        maxSnapshotsPerSymbol: 20,
        weeklyWindow: 7,
        monthlyWindow: 30,
        quarterlyWindow: 90,
        indicatorMode: 'stochRsi_only',
        disabledIndicators: ['atr']
      })
    );
  });

  it('returns a filtered backtest report', async () => {
    const response = await fetch(
      `${baseUrl}/api/stocks/backtests/reports?runId=run-1&symbols=AAA,BBB&timeframe=midTerm&forNewPosition=WAIT&groupBy=sector`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      report: {
        sampleCount: 10
      }
    });
    expect(backtestService.getReport).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        symbols: ['AAA', 'BBB'],
        timeframe: 'midTerm',
        forNewPosition: 'WAIT',
        groupBy: 'sector'
      })
    );
  });

  it('runs a comparison matrix for one symbol', async () => {
    const response = await fetch(`${baseUrl}/api/stocks/backtests/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: ' TEST ',
        weeklyWindow: 7,
        monthlyWindow: 30,
        quarterlyWindow: 90,
        variants: ['full_composite', 'stochRsi_only'],
        reportLimit: 2000
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      symbol: 'TEST',
      comparisonCount: 2
    });
    expect(backtestService.compareBacktests).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'TEST',
        weeklyWindow: 7,
        monthlyWindow: 30,
        quarterlyWindow: 90,
        variants: ['full_composite', 'stochRsi_only'],
        reportLimit: 2000
      })
    );
  });
});
