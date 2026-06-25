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

const discountCodeServiceMocks = vi.hoisted(() => ({
  previewDiscountCode: vi.fn(),
  createDiscountCode: vi.fn(),
  updateStatus: vi.fn(),
  redeemDiscountCode: vi.fn()
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

vi.mock('../src/services/discountCode.service', () => ({
  discountCodeService: {
    previewDiscountCode: discountCodeServiceMocks.previewDiscountCode,
    createDiscountCode: discountCodeServiceMocks.createDiscountCode,
    updateStatus: discountCodeServiceMocks.updateStatus,
    redeemDiscountCode: discountCodeServiceMocks.redeemDiscountCode
  }
}));

vi.mock('../src/config/env', async () => {
  const actual = await vi.importActual<typeof import('../src/config/env')>('../src/config/env');

  return {
    env: {
      ...actual.env,
      INTERNAL_API_TOKEN: 'internal-test-token'
    }
  };
});

import { createApp } from '../src/app';

describe('discount code routes', () => {
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
    discountCodeServiceMocks.previewDiscountCode.mockReset();
    discountCodeServiceMocks.createDiscountCode.mockReset();
    discountCodeServiceMocks.updateStatus.mockReset();
    discountCodeServiceMocks.redeemDiscountCode.mockReset();
  });

  it('returns a preview for an authenticated checkout request', async () => {
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
    discountCodeServiceMocks.previewDiscountCode.mockResolvedValue({
      valid: true,
      status: 'VALID',
      code: 'SUMMER25',
      planCode: 'monthly',
      originalAmount: '4900000.00',
      discountAmount: '1225000.00',
      finalAmount: '3675000.00',
      currency: 'IRR',
      paymentSnapshot: {
        amountBeforeDiscount: '4900000.00',
        discountAmount: '1225000.00',
        finalAmount: '3675000.00',
        discountCodeSnapshot: '{"code":"SUMMER25"}'
      }
    });

    const response = await fetch(`${baseUrl}/api/discount-codes/preview`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'summer25',
        planCode: 'monthly'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      preview: {
        status: 'VALID',
        finalAmount: '3675000.00'
      }
    });
    expect(discountCodeServiceMocks.previewDiscountCode).toHaveBeenCalledWith({
      code: 'summer25',
      planCode: 'monthly'
    });
  });

  it('requires authentication for preview requests', async () => {
    const response = await fetch(`${baseUrl}/api/discount-codes/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'summer25',
        planCode: 'monthly'
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Authentication required'
    });
  });

  it('creates discount codes for internal workflows', async () => {
    discountCodeServiceMocks.createDiscountCode.mockResolvedValue({
      id: 'discount-1',
      code: 'SUMMER25',
      name: 'Summer 25',
      status: 'ACTIVE',
      valueType: 'PERCENTAGE',
      value: '25.00',
      applicablePlanCodes: ['monthly'],
      redemptionCount: 0
    });

    const response = await fetch(`${baseUrl}/api/admin/discount-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-token': 'internal-test-token'
      },
      body: JSON.stringify({
        code: 'summer25',
        name: 'Summer 25',
        valueType: 'PERCENTAGE',
        value: '25',
        applicablePlanCodes: ['monthly']
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      discountCode: {
        code: 'SUMMER25',
        valueType: 'PERCENTAGE'
      }
    });
  });

  it('updates discount code status for internal workflows', async () => {
    discountCodeServiceMocks.updateStatus.mockResolvedValue({
      id: 'discount-1',
      code: 'SUMMER25',
      status: 'DISABLED'
    });

    const response = await fetch(`${baseUrl}/api/admin/discount-codes/discount-1/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-token': 'internal-test-token'
      },
      body: JSON.stringify({
        status: 'DISABLED'
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      discountCode: {
        id: 'discount-1',
        status: 'DISABLED'
      }
    });
  });

  it('rejects internal management without the internal token', async () => {
    const response = await fetch(`${baseUrl}/api/admin/discount-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'summer25',
        name: 'Summer 25',
        valueType: 'PERCENTAGE',
        value: '25'
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Invalid internal API token'
    });
  });
});
