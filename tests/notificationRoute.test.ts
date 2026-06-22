import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/telegramNotifier.service', () => ({
  telegramNotifier: {
    send: vi.fn().mockResolvedValue(true),
    isConfigured: vi.fn().mockReturnValue(true)
  }
}));

import { createApp } from '../src/app';
import { telegramNotifier } from '../src/services/telegramNotifier.service';

describe('notification route', () => {
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

  it('sends a telegram test notification', async () => {
    const response = await fetch(`${baseUrl}/api/notifications/telegram/test`, {
      method: 'POST'
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      sent: true,
      telegramConfigured: true
    });
    expect(telegramNotifier.send).toHaveBeenCalledWith(
      'Test notification',
      expect.objectContaining({
        source: 'manual_test_endpoint',
        path: '/api/notifications/telegram/test',
        method: 'POST'
      })
    );
  });
});
