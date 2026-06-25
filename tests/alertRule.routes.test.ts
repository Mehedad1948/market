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

const alertRuleServiceMocks = vi.hoisted(() => ({
  listRules: vi.fn(),
  createRule: vi.fn(),
  deleteRule: vi.fn()
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

vi.mock('../src/services/alertRule.service', () => ({
  alertRuleService: {
    listRules: alertRuleServiceMocks.listRules,
    createRule: alertRuleServiceMocks.createRule,
    deleteRule: alertRuleServiceMocks.deleteRule
  }
}));

import { createApp } from '../src/app';

describe('alert rule routes', () => {
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
    alertRuleServiceMocks.listRules.mockReset();
    alertRuleServiceMocks.createRule.mockReset();
    alertRuleServiceMocks.deleteRule.mockReset();

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

  it('lists the authenticated user alert rules', async () => {
    alertRuleServiceMocks.listRules.mockResolvedValue([
      {
        id: 'rule-1',
        type: 'SIGNAL_ACTION',
        scope: 'ALL_WATCHLIST'
      }
    ]);

    const response = await fetch(`${baseUrl}/api/alerts/rules`, {
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      rules: [
        {
          id: 'rule-1',
          type: 'SIGNAL_ACTION'
        }
      ]
    });
    expect(alertRuleServiceMocks.listRules).toHaveBeenCalledWith('user-1');
  });

  it('creates an alert rule for the authenticated user', async () => {
    alertRuleServiceMocks.createRule.mockResolvedValue({
      id: 'rule-1',
      type: 'SIGNAL_SCORE',
      scope: 'ALL_WATCHLIST',
      minScore: 40
    });

    const response = await fetch(`${baseUrl}/api/alerts/rules`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SIGNAL_SCORE',
        minScore: 40
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      rule: {
        id: 'rule-1',
        minScore: 40
      }
    });
    expect(alertRuleServiceMocks.createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SIGNAL_SCORE',
        minScore: 40
      })
    );
  });

  it('deletes an alert rule for the authenticated user', async () => {
    alertRuleServiceMocks.deleteRule.mockResolvedValue({
      id: 'rule-1'
    });

    const response = await fetch(`${baseUrl}/api/alerts/rules/rule-1`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      removed: {
        id: 'rule-1'
      }
    });
    expect(alertRuleServiceMocks.deleteRule).toHaveBeenCalledWith('user-1', 'rule-1');
  });
});
