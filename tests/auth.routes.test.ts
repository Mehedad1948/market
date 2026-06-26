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
  revokeSession: vi.fn(),
  requestEmailLoginOtp: vi.fn(),
  verifyEmailLoginOtp: vi.fn(),
  authenticateWithBale: vi.fn(),
  authenticateWithTelegram: vi.fn(),
  authenticateWithGoogle: vi.fn()
}));

vi.mock('../src/services/auth.service', () => ({
  authService: {
    buildAnonymousAuthContext: authServiceMocks.buildAnonymousAuthContext,
    getAuthContextFromToken: authServiceMocks.getAuthContextFromToken,
    revokeSession: authServiceMocks.revokeSession,
    requestEmailLoginOtp: authServiceMocks.requestEmailLoginOtp,
    verifyEmailLoginOtp: authServiceMocks.verifyEmailLoginOtp,
    authenticateWithBale: authServiceMocks.authenticateWithBale,
    authenticateWithTelegram: authServiceMocks.authenticateWithTelegram,
    authenticateWithGoogle: authServiceMocks.authenticateWithGoogle
  },
  extractBearerToken: authServiceMocks.extractBearerToken
}));

vi.mock('../src/config/env', async () => {
  const actual = await vi.importActual<typeof import('../src/config/env')>(
    '../src/config/env'
  );

  return {
    env: {
      ...actual.env,
      BALE_BOT_TOKEN: 'test-bale-token',
      TELEGRAM_BOT_TOKEN: 'telegram-test-bot-token',
      GOOGLE_CLIENT_ID: 'google-client-id-1'
    }
  };
});

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
    authServiceMocks.requestEmailLoginOtp.mockReset();
    authServiceMocks.verifyEmailLoginOtp.mockReset();
    authServiceMocks.authenticateWithBale.mockReset();
    authServiceMocks.authenticateWithTelegram.mockReset();
    authServiceMocks.authenticateWithGoogle.mockReset();
    process.env.BALE_BOT_TOKEN = 'test-bale-token';
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
        telegramUserId: '42',
        telegramUsername: 'bale-user',
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
        email: 'user@example.com',
        telegramUserId: '42',
        telegramUsername: 'bale-user'
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

  it('authenticates a new Bale user through the callback endpoint', async () => {
    authServiceMocks.authenticateWithBale.mockResolvedValue({
      token: 'session-token-1',
      session: {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-1',
        email: 'bale@example.com',
        telegramUserId: '42',
        telegramUsername: 'bale-user',
        isActive: true
      },
      authAccount: {
        id: 'auth-1',
        provider: 'BALE',
        providerAccountId: '42'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });

    const response = await fetch(`${baseUrl}/api/auth/bale/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bale-bot-token': 'test-bale-token'
      },
      body: JSON.stringify({
        baleUser: {
          id: '42',
          username: 'bale-user'
        },
        email: 'bale@example.com'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      provider: 'BALE',
      token: 'session-token-1',
      user: {
        id: 'user-1',
        telegramUserId: '42'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });
    expect(authServiceMocks.authenticateWithBale).toHaveBeenCalledWith(
      expect.objectContaining({
        baleUser: expect.objectContaining({
          id: '42'
        }),
        currentUserId: null
      })
    );
  });

  it('requests an email OTP', async () => {
    authServiceMocks.requestEmailLoginOtp.mockResolvedValue({
      email: 'user@example.com',
      expiresAt: '2026-06-26T10:10:00.000Z',
      retryAfterSeconds: 60
    });

    const response = await fetch(`${baseUrl}/api/auth/email/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      channel: 'EMAIL',
      email: 'user@example.com',
      retryAfterSeconds: 60
    });
    expect(authServiceMocks.requestEmailLoginOtp).toHaveBeenCalledWith({
      email: 'user@example.com'
    });
  });

  it('verifies an email OTP and returns a session', async () => {
    authServiceMocks.verifyEmailLoginOtp.mockResolvedValue({
      token: 'email-session-token',
      session: {
        id: 'session-email',
        userId: 'user-email',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-email',
        email: 'user@example.com',
        isActive: true
      },
      authAccount: {
        id: 'auth-email',
        provider: 'EMAIL',
        providerAccountId: 'user@example.com'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });

    const response = await fetch(`${baseUrl}/api/auth/email/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        code: '123456',
        displayName: 'Email User'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      provider: 'EMAIL',
      token: 'email-session-token',
      user: {
        id: 'user-email',
        email: 'user@example.com'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });
    expect(authServiceMocks.verifyEmailLoginOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        code: '123456',
        displayName: 'Email User',
        currentUserId: null
      })
    );
  });

  it('authenticates a repeat Bale login through the callback endpoint', async () => {
    authServiceMocks.authenticateWithBale.mockResolvedValue({
      token: 'session-token-2',
      session: {
        id: 'session-2',
        userId: 'user-1',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-1',
        email: 'bale@example.com',
        telegramUserId: '42',
        telegramUsername: 'bale-user',
        isActive: true
      },
      authAccount: {
        id: 'auth-1',
        provider: 'BALE',
        providerAccountId: '42'
      },
      isNewUser: false,
      isNewAuthAccount: false
    });

    const response = await fetch(`${baseUrl}/api/auth/bale/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bale-bot-token': 'test-bale-token'
      },
      body: JSON.stringify({
        baleUser: {
          id: 42,
          username: 'bale-user'
        }
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      isNewUser: false,
      isNewAuthAccount: false
    });
  });

  it('links a Bale account to the authenticated user through the callback endpoint', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue('token-1');
    authServiceMocks.getAuthContextFromToken.mockResolvedValue({
      token: 'token-1',
      isAuthenticated: true,
      session: {
        id: 'session-existing',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-existing',
        email: 'existing@example.com',
        isActive: true
      }
    });
    authServiceMocks.authenticateWithBale.mockResolvedValue({
      token: 'session-token-3',
      session: {
        id: 'session-3',
        userId: 'user-existing',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-existing',
        email: 'existing@example.com',
        telegramUserId: '9001',
        telegramUsername: 'linked-user',
        isActive: true
      },
      authAccount: {
        id: 'auth-3',
        provider: 'BALE',
        providerAccountId: '9001'
      },
      isNewUser: false,
      isNewAuthAccount: true
    });

    const response = await fetch(`${baseUrl}/api/auth/bale/callback`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
        'x-bale-bot-token': 'test-bale-token'
      },
      body: JSON.stringify({
        baleUser: {
          id: '9001',
          username: 'linked-user'
        },
        email: 'existing@example.com'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      isNewUser: false,
      isNewAuthAccount: true,
      linkedAccount: true,
      user: {
        id: 'user-existing',
        telegramUserId: '9001'
      }
    });
    expect(authServiceMocks.authenticateWithBale).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: 'user-existing',
        email: 'existing@example.com',
        baleUser: expect.objectContaining({
          id: '9001'
        })
      })
    );
  });

  it('rejects Bale callback requests with an invalid bot token', async () => {
    const response = await fetch(`${baseUrl}/api/auth/bale/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bale-bot-token': 'wrong-token'
      },
      body: JSON.stringify({
        baleUser: {
          id: '42'
        }
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Invalid Bale bot token'
    });
  });

  it('rejects invalid Bale callback payloads', async () => {
    const response = await fetch(`${baseUrl}/api/auth/bale/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bale-bot-token': 'test-bale-token'
      },
      body: JSON.stringify({
        email: 'not-valid'
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Invalid Bale auth payload'
    });
  });

  it('authenticates a Telegram user through the callback endpoint', async () => {
    authServiceMocks.authenticateWithTelegram.mockResolvedValue({
      token: 'telegram-session-token',
      session: {
        id: 'session-telegram',
        userId: 'user-telegram',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-telegram',
        telegramUserId: '12345',
        telegramUsername: 'tg-user',
        isActive: true
      },
      authAccount: {
        id: 'auth-telegram',
        provider: 'TELEGRAM',
        providerAccountId: '12345'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });

    const response = await fetch(`${baseUrl}/api/auth/telegram/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: '12345',
        first_name: 'Telegram',
        username: 'tg-user',
        auth_date: 1719000000,
        hash: 'signed-hash'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      provider: 'TELEGRAM',
      token: 'telegram-session-token',
      user: {
        id: 'user-telegram',
        telegramUserId: '12345'
      }
    });
    expect(authServiceMocks.authenticateWithTelegram).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramUser: expect.objectContaining({
          id: '12345',
          firstName: 'Telegram'
        })
      })
    );
  });

  it('authenticates a Google user through the callback endpoint', async () => {
    authServiceMocks.authenticateWithGoogle.mockResolvedValue({
      token: 'google-session-token',
      session: {
        id: 'session-google',
        userId: 'user-google',
        expiresAt: '2026-07-20T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      user: {
        id: 'user-google',
        email: 'google@example.com',
        isActive: true
      },
      authAccount: {
        id: 'auth-google',
        provider: 'GOOGLE',
        providerAccountId: 'google-sub-1'
      },
      isNewUser: true,
      isNewAuthAccount: true
    });

    const response = await fetch(`${baseUrl}/api/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken: 'google-id-token',
        nonce: 'nonce-1'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      provider: 'GOOGLE',
      token: 'google-session-token',
      user: {
        id: 'user-google',
        email: 'google@example.com'
      }
    });
    expect(authServiceMocks.authenticateWithGoogle).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: 'google-id-token',
        nonce: 'nonce-1'
      })
    );
  });
});
