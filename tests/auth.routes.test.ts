import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authServiceMocks = vi.hoisted(() => ({
  buildAnonymousAuthContext: vi.fn(() => ({
    token: null,
    user: null,
    session: null,
    isAuthenticated: false
  })),
  getAuthContextFromToken: vi.fn(),
  extractBearerToken: vi.fn(),
  revokeSession: vi.fn()
}));

vi.mock('../src/services/auth.service', () => ({
  authService: {
    buildAnonymousAuthContext: authServiceMocks.buildAnonymousAuthContext,
    getAuthContextFromToken: authServiceMocks.getAuthContextFromToken,
    revokeSession: authServiceMocks.revokeSession
  },
  extractBearerToken: authServiceMocks.extractBearerToken
}));

import { createApp } from '../src/app';

describe('auth routes', () => {
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
    authServiceMocks.extractBearerToken.mockReset();
    authServiceMocks.revokeSession.mockReset();
  });

  it('returns anonymous auth state when no session is present', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue(null);

    const response = await fetch(`${baseUrl}/api/auth/me`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      authenticated: false,
      user: null,
      session: null
    });
  });

  it('returns the current user when a valid bearer session exists', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue('token-1');
    authServiceMocks.getAuthContextFromToken.mockResolvedValue({
      token: 'token-1',
      isAuthenticated: true,
      session: {
        id: 'session-1',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isActive: true
      }
    });

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'user@example.com'
      },
      session: {
        id: 'session-1'
      }
    });
  });

  it('revokes the current session on logout', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue('token-1');
    authServiceMocks.getAuthContextFromToken.mockResolvedValue({
      token: 'token-1',
      isAuthenticated: true,
      session: {
        id: 'session-1',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isActive: true
      }
    });
    authServiceMocks.revokeSession.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      loggedOut: true
    });
    expect(authServiceMocks.revokeSession).toHaveBeenCalledWith('session-1');
  });

  it('rejects logout without an authenticated session', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue(null);

    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST'
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Authentication required'
    });
  });
});
