import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/signalScan.service', () => ({
  signalScanService: {
    runScan: vi.fn().mockResolvedValue({
      status: 'OK',
      scannedAt: '2026-06-19T12:00:00.000Z',
      symbolsRequested: 1,
      scannedCount: 1,
      okCount: 1,
      insufficientDataCount: 0,
      errorCount: 0,
      results: [
        {
          symbol: 'TEST',
          status: 'OK',
          action: 'HOLD',
          score: 10,
          latestDataDate: '1403-01-01'
        }
      ]
    })
  }
}));

import { createApp } from '../src/app';
import { signalScanService } from '../src/services/signalScan.service';

describe('manual signal scan route', () => {
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

  it('returns the scan summary payload', async () => {
    const response = await fetch(`${baseUrl}/api/stocks/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbols: ['TEST']
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      scannedCount: 1,
      results: [
        {
          symbol: 'TEST',
          action: 'HOLD'
        }
      ]
    });
    expect(signalScanService.runScan).toHaveBeenCalledWith({
      symbols: ['TEST']
    });
  });
});
