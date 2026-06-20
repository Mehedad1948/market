import { beforeEach, describe, expect, it, vi } from 'vitest';

const authServiceMocks = vi.hoisted(() => ({
  buildAnonymousAuthContext: vi.fn(() => ({
    token: null,
    user: null,
    session: null,
    isAuthenticated: false
  })),
  getAuthContextFromToken: vi.fn(),
  extractBearerToken: vi.fn()
}));

vi.mock('../src/services/auth.service', () => ({
  authService: {
    buildAnonymousAuthContext: authServiceMocks.buildAnonymousAuthContext,
    getAuthContextFromToken: authServiceMocks.getAuthContextFromToken
  },
  extractBearerToken: authServiceMocks.extractBearerToken
}));

import { authMiddleware, requireAuthenticatedUser } from '../src/middleware/auth';

describe('auth.middleware', () => {
  beforeEach(() => {
    authServiceMocks.buildAnonymousAuthContext.mockClear();
    authServiceMocks.getAuthContextFromToken.mockReset();
    authServiceMocks.extractBearerToken.mockReset();
  });

  it('keeps the request anonymous when no bearer token exists', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue(null);
    const next = vi.fn();
    const request = {
      headers: {},
      auth: undefined,
      currentUser: undefined
    } as any;

    await authMiddleware(request, {} as any, next);

    expect(authServiceMocks.buildAnonymousAuthContext).toHaveBeenCalledTimes(1);
    expect(authServiceMocks.getAuthContextFromToken).not.toHaveBeenCalled();
    expect(request.auth.isAuthenticated).toBe(false);
    expect(request.currentUser).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches the current user for a valid bearer token', async () => {
    authServiceMocks.extractBearerToken.mockReturnValue('token-1');
    authServiceMocks.getAuthContextFromToken.mockResolvedValue({
      token: 'token-1',
      isAuthenticated: true,
      session: {
        id: 'session-1'
      },
      user: {
        id: 'user-1',
        email: 'user@example.com'
      }
    });
    const next = vi.fn();
    const request = {
      headers: {
        authorization: 'Bearer token-1'
      },
      auth: undefined,
      currentUser: undefined
    } as any;

    await authMiddleware(request, {} as any, next);

    expect(authServiceMocks.getAuthContextFromToken).toHaveBeenCalledWith(
      'token-1'
    );
    expect(request.auth.isAuthenticated).toBe(true);
    expect(request.currentUser).toEqual({
      id: 'user-1',
      email: 'user@example.com'
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('throws a 401 app error when an authenticated user is required', () => {
    expect(() =>
      requireAuthenticatedUser({
        auth: {
          isAuthenticated: false
        },
        currentUser: null
      } as any)
    ).toThrow('نیاز به احراز هویت دارید.');
  });
});
