import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/signalScan.service', () => ({
  signalScanService: {
    runScan: vi.fn(),
    getScheduleStatus: vi.fn().mockReturnValue({
      enabled: true,
      cron: '0 22 * * 0-4',
      timezone: 'Asia/Tehran',
      isRegistered: true,
      taskStatus: 'idle',
      nextRunAt: '2026-06-21T18:30:00.000Z',
      serverTime: '2026-06-21T09:00:00.000Z',
      timezoneLocalTime: '2026-06-21, 12:30:00'
    }),
    getRuntimeStatus: vi.fn().mockReturnValue({
      isRunning: false,
      lastStartedAt: '2026-06-21T09:00:00.000Z',
      lastFinishedAt: '2026-06-21T09:12:00.000Z',
      lastTriggeredAt: '2026-06-21T09:00:00.000Z',
      lastOutcome: 'SUCCESS',
      lastScannedAt: '2026-06-21T09:12:00.000Z',
      lastSymbolsRequested: 20,
      lastScannedCount: 20,
      lastOkCount: 18,
      lastInsufficientDataCount: 1,
      lastErrorCount: 1,
      lastError: null,
      currentPhase: 'IDLE',
      currentPhaseStartedAt: null,
      currentSymbol: null,
      currentSymbolIndex: null,
      symbolsTotal: 20,
      symbolsCompleted: 20,
      currentSymbolStartedAt: null
    })
  },
  ScanAlreadyRunningError: class ScanAlreadyRunningError extends Error {}
}));

import { createApp } from '../src/app';
import { signalScanService } from '../src/services/signalScan.service';

describe('signal scan status route', () => {
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

  it('returns in-memory signal scan runtime status', async () => {
    const response = await fetch(`${baseUrl}/api/stocks/scan/status`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      isRunning: false,
      lastOutcome: 'SUCCESS',
      lastTriggeredAt: '2026-06-21T09:00:00.000Z',
      lastSymbolsRequested: 20,
      lastScannedCount: 20,
      lastOkCount: 18,
      lastInsufficientDataCount: 1,
      lastErrorCount: 1,
      currentPhase: 'IDLE',
      symbolsTotal: 20,
      symbolsCompleted: 20,
      schedule: {
        enabled: true,
        cron: '0 22 * * 0-4',
        timezone: 'Asia/Tehran',
        isRegistered: true
      }
    });
    expect(signalScanService.getRuntimeStatus).toHaveBeenCalledTimes(1);
    expect(signalScanService.getScheduleStatus).toHaveBeenCalledTimes(1);
  });
});
