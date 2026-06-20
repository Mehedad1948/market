import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  findActiveByTokenHash: vi.fn(),
  revokeById: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  updateLastLogin: vi.fn()
}));

vi.mock('../src/repositories/session.repository', () => ({
  sessionRepository: {
    create: repositoryMocks.createSession,
    findActiveByTokenHash: repositoryMocks.findActiveByTokenHash,
    revokeById: repositoryMocks.revokeById
  }
}));

vi.mock('../src/repositories/user.repository', () => ({
  userRepository: {
    findById: repositoryMocks.findById,
    findByEmail: repositoryMocks.findByEmail,
    updateLastLogin: repositoryMocks.updateLastLogin
  }
}));

import {
  authService,
  extractBearerToken,
  hashSessionToken
} from '../src/services/auth.service';

describe('auth.service', () => {
  beforeEach(() => {
    repositoryMocks.createSession.mockReset();
    repositoryMocks.findActiveByTokenHash.mockReset();
    repositoryMocks.revokeById.mockReset();
    repositoryMocks.findById.mockReset();
    repositoryMocks.findByEmail.mockReset();
    repositoryMocks.updateLastLogin.mockReset();
  });

  it('extracts a bearer token from the authorization header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('Bearer    xyz   ')).toBe('xyz');
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('hashes session tokens deterministically', () => {
    expect(hashSessionToken('token-1')).toBe(hashSessionToken('token-1'));
    expect(hashSessionToken('token-1')).not.toBe('token-1');
  });

  it('creates a session with a hashed token and updates last login', async () => {
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: '127.0.0.1',
      userAgent: 'vitest',
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);

    const result = await authService.createSession('user-1', {
      ip: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(result.token).toEqual(expect.any(String));
    expect(repositoryMocks.createSession).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.createSession.mock.calls[0]?.[0]).toMatchObject({
      userId: 'user-1',
      ip: '127.0.0.1',
      userAgent: 'vitest',
      tokenHash: expect.any(String),
      expiresAt: expect.any(Date)
    });
    expect(repositoryMocks.createSession.mock.calls[0]?.[0].tokenHash).not.toBe(
      result.token
    );
    expect(repositoryMocks.updateLastLogin).toHaveBeenCalledWith('user-1');
    expect(result.session?.userId).toBe('user-1');
  });

  it('returns an authenticated context for an active session', async () => {
    repositoryMocks.findActiveByTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      user: {
        id: 'user-1',
        displayName: 'User One',
        firstName: null,
        lastName: null,
        email: 'user@example.com',
        phone: null,
        avatarUrl: null,
        telegramUserId: null,
        telegramUsername: null,
        isActive: true,
        trialUsed: false,
        lastLoginAt: null,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
        updatedAt: new Date('2026-06-20T00:00:00.000Z')
      }
    });

    const context = await authService.getAuthContextFromToken('raw-token');

    expect(repositoryMocks.findActiveByTokenHash).toHaveBeenCalledWith(
      hashSessionToken('raw-token')
    );
    expect(context.isAuthenticated).toBe(true);
    expect(context.user?.email).toBe('user@example.com');
    expect(context.session?.id).toBe('session-1');
  });

  it('returns an anonymous context for inactive or missing users', async () => {
    repositoryMocks.findActiveByTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      user: {
        id: 'user-1',
        displayName: null,
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        avatarUrl: null,
        telegramUserId: null,
        telegramUsername: null,
        isActive: false,
        trialUsed: false,
        lastLoginAt: null,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
        updatedAt: new Date('2026-06-20T00:00:00.000Z')
      }
    });

    const context = await authService.getAuthContextFromToken('raw-token');

    expect(context.isAuthenticated).toBe(false);
    expect(context.user).toBeNull();
    expect(context.session).toBeNull();
  });
});
