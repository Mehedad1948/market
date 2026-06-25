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

const subscriptionServiceMocks = vi.hoisted(() => ({
  resolveAccessForUser: vi.fn(),
  activateTrial: vi.fn()
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

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    resolveAccessForUser: subscriptionServiceMocks.resolveAccessForUser,
    activateTrial: subscriptionServiceMocks.activateTrial
  }
}));

import { AppError } from '../src/middleware/errorHandler';
import { createApp } from '../src/app';

describe('subscription routes', () => {
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
    subscriptionServiceMocks.resolveAccessForUser.mockReset();
    subscriptionServiceMocks.activateTrial.mockReset();
  });

  it('returns the effective subscription access for the authenticated user', async () => {
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
    subscriptionServiceMocks.resolveAccessForUser.mockResolvedValue({
      userId: 'user-1',
      trialUsed: false,
      hasAccess: false,
      level: 'NONE',
      reason: 'NO_SUBSCRIPTION',
      subscription: null
    });

    const response = await fetch(`${baseUrl}/api/auth/subscription`, {
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      access: {
        userId: 'user-1',
        level: 'NONE',
        reason: 'NO_SUBSCRIPTION'
      }
    });
    expect(subscriptionServiceMocks.resolveAccessForUser).toHaveBeenCalledWith('user-1');
  });

  it('activates a trial subscription for the authenticated user', async () => {
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
    subscriptionServiceMocks.activateTrial.mockResolvedValue({
      userId: 'user-1',
      trialUsed: true,
      hasAccess: true,
      level: 'TRIAL',
      reason: 'ACTIVE_TRIAL',
      subscription: {
        id: 'subscription-trial',
        status: 'TRIALING',
        startsAt: '2026-06-25T10:00:00.000Z',
        endsAt: '2026-07-09T10:00:00.000Z',
        plan: {
          code: 'trial-14d',
          durationDays: 14,
          isTrial: true
        }
      }
    });

    const response = await fetch(`${baseUrl}/api/auth/subscription/trial`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      access: {
        userId: 'user-1',
        trialUsed: true,
        level: 'TRIAL',
        reason: 'ACTIVE_TRIAL',
        subscription: {
          plan: {
            code: 'trial-14d',
            durationDays: 14
          }
        }
      }
    });
    expect(subscriptionServiceMocks.activateTrial).toHaveBeenCalledWith('user-1');
  });

  it('rejects trial reuse attempts', async () => {
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
    subscriptionServiceMocks.activateTrial.mockRejectedValue(
      new AppError('دوره آزمایشی قبلا فعال شده است.', 409, {
        englishMessage: 'Trial already used'
      })
    );

    const response = await fetch(`${baseUrl}/api/auth/subscription/trial`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Trial already used'
    });
  });

  it('requires authentication for subscription endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/auth/subscription`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Authentication required'
    });
  });
});
