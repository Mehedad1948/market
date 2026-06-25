import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authServiceMocks = vi.hoisted(() => ({
  buildAnonymousAuthContext: vi.fn(() => ({
    token: null,
    user: null,
    session: null,
    isAuthenticated: false
  })),
  getAuthContextFromToken: vi.fn()
}));

const watchlistServiceMocks = vi.hoisted(() => ({
  listWatchlist: vi.fn(),
  addSymbol: vi.fn(),
  removeSymbol: vi.fn()
}));

vi.mock('../src/services/auth.service', () => ({
  authService: {
    buildAnonymousAuthContext: authServiceMocks.buildAnonymousAuthContext,
    getAuthContextFromToken: authServiceMocks.getAuthContextFromToken
  },
  extractBearerToken: (headerValue: string | undefined) => {
    if (!headerValue?.startsWith('Bearer ')) {
      return null;
    }

    return headerValue.slice('Bearer '.length).trim() || null;
  }
}));

vi.mock('../src/services/watchlist.service', () => ({
  watchlistService: {
    listWatchlist: watchlistServiceMocks.listWatchlist,
    addSymbol: watchlistServiceMocks.addSymbol,
    removeSymbol: watchlistServiceMocks.removeSymbol
  }
}));

import { createApp } from '../src/app';

describe('watchlist routes', () => {
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
    authServiceMocks.buildAnonymousAuthContext.mockClear();
    authServiceMocks.getAuthContextFromToken.mockReset();
    watchlistServiceMocks.listWatchlist.mockReset();
    watchlistServiceMocks.addSymbol.mockReset();
    watchlistServiceMocks.removeSymbol.mockReset();

    authServiceMocks.getAuthContextFromToken.mockResolvedValue({
      token: 'token-1',
      isAuthenticated: true,
      session: {
        id: 'session-1'
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isActive: true
      }
    });
  });

  it('lists the authenticated user watchlist', async () => {
    watchlistServiceMocks.listWatchlist.mockResolvedValue([
      {
        id: 'watch-1',
        symbol: 'FMLI',
        createdAt: '2026-06-25T10:00:00.000Z'
      }
    ]);

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      items: [
        {
          symbol: 'FMLI'
        }
      ]
    });
    expect(watchlistServiceMocks.listWatchlist).toHaveBeenCalledWith('user-1');
  });

  it('adds a symbol to the authenticated user watchlist', async () => {
    watchlistServiceMocks.addSymbol.mockResolvedValue({
      id: 'watch-1',
      symbol: 'FMLI',
      createdAt: '2026-06-25T10:00:00.000Z'
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: 'fmli'
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      item: {
        symbol: 'FMLI'
      }
    });
    expect(watchlistServiceMocks.addSymbol).toHaveBeenCalledWith('user-1', 'fmli');
  });

  it('removes a symbol from the authenticated user watchlist', async () => {
    watchlistServiceMocks.removeSymbol.mockResolvedValue({
      symbol: 'FMLI'
    });

    const response = await fetch(`${baseUrl}/api/watchlist/FMLI`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      removed: {
        symbol: 'FMLI'
      }
    });
    expect(watchlistServiceMocks.removeSymbol).toHaveBeenCalledWith('user-1', 'FMLI');
  });

  it('requires authentication for watchlist routes', async () => {
    const response = await fetch(`${baseUrl}/api/watchlist`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Authentication required'
    });
  });
});
