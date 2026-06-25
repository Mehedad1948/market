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

const portfolioServiceMocks = vi.hoisted(() => ({
  listPortfolios: vi.fn(),
  getPortfolio: vi.fn(),
  createPortfolio: vi.fn(),
  renamePortfolio: vi.fn(),
  deletePortfolio: vi.fn(),
  addHolding: vi.fn(),
  updateHolding: vi.fn(),
  removeHolding: vi.fn()
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

vi.mock('../src/services/portfolio.service', () => ({
  portfolioService: {
    listPortfolios: portfolioServiceMocks.listPortfolios,
    getPortfolio: portfolioServiceMocks.getPortfolio,
    createPortfolio: portfolioServiceMocks.createPortfolio,
    renamePortfolio: portfolioServiceMocks.renamePortfolio,
    deletePortfolio: portfolioServiceMocks.deletePortfolio,
    addHolding: portfolioServiceMocks.addHolding,
    updateHolding: portfolioServiceMocks.updateHolding,
    removeHolding: portfolioServiceMocks.removeHolding
  }
}));

import { createApp } from '../src/app';

describe('portfolio routes', () => {
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
    portfolioServiceMocks.listPortfolios.mockReset();
    portfolioServiceMocks.getPortfolio.mockReset();
    portfolioServiceMocks.createPortfolio.mockReset();
    portfolioServiceMocks.renamePortfolio.mockReset();
    portfolioServiceMocks.deletePortfolio.mockReset();
    portfolioServiceMocks.addHolding.mockReset();
    portfolioServiceMocks.updateHolding.mockReset();
    portfolioServiceMocks.removeHolding.mockReset();

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

  it('lists the authenticated user portfolios', async () => {
    portfolioServiceMocks.listPortfolios.mockResolvedValue([
      {
        id: 'portfolio-1',
        name: 'Core',
        metrics: {
          holdingsCount: 1
        },
        holdings: []
      }
    ]);

    const response = await fetch(`${baseUrl}/api/portfolios`, {
      headers: {
        Authorization: 'Bearer token-1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      portfolios: [
        {
          name: 'Core'
        }
      ]
    });
    expect(portfolioServiceMocks.listPortfolios).toHaveBeenCalledWith('user-1');
  });

  it('creates a portfolio for the authenticated user', async () => {
    portfolioServiceMocks.createPortfolio.mockResolvedValue({
      id: 'portfolio-1',
      name: 'Swing',
      holdings: []
    });

    const response = await fetch(`${baseUrl}/api/portfolios`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Swing'
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      portfolio: {
        name: 'Swing'
      }
    });
    expect(portfolioServiceMocks.createPortfolio).toHaveBeenCalledWith(
      'user-1',
      'Swing'
    );
  });

  it('adds a holding for the authenticated user', async () => {
    portfolioServiceMocks.addHolding.mockResolvedValue({
      id: 'portfolio-1',
      holdings: [
        {
          symbol: 'FMLI'
        }
      ]
    });

    const response = await fetch(`${baseUrl}/api/portfolios/portfolio-1/holdings`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: 'fmli',
        quantity: 10,
        averageBuyPrice: 100
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      portfolio: {
        holdings: [
          {
            symbol: 'FMLI'
          }
        ]
      }
    });
    expect(portfolioServiceMocks.addHolding).toHaveBeenCalledWith(
      'user-1',
      'portfolio-1',
      {
        symbol: 'fmli',
        quantity: 10,
        averageBuyPrice: 100
      }
    );
  });

  it('rejects invalid holding payloads', async () => {
    const response = await fetch(`${baseUrl}/api/portfolios/portfolio-1/holdings`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: '   ',
        quantity: -1
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Invalid portfolio holding payload'
    });
    expect(portfolioServiceMocks.addHolding).not.toHaveBeenCalled();
  });

  it('requires authentication for portfolio routes', async () => {
    const response = await fetch(`${baseUrl}/api/portfolios`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ERROR',
      englishMessage: 'Authentication required'
    });
  });
});
