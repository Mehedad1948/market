import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  findActiveByTokenHash: vi.fn(),
  revokeById: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByPhone: vi.fn(),
  findByTelegramUserId: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  updateLastLogin: vi.fn(),
  findAuthAccountByProviderAccount: vi.fn(),
  upsertAuthAccountByProviderAccount: vi.fn()
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
    create: repositoryMocks.createUser,
    findById: repositoryMocks.findById,
    findByEmail: repositoryMocks.findByEmail,
    findByPhone: repositoryMocks.findByPhone,
    findByTelegramUserId: repositoryMocks.findByTelegramUserId,
    update: repositoryMocks.updateUser,
    updateLastLogin: repositoryMocks.updateLastLogin
  }
}));

vi.mock('../src/repositories/userAuthAccount.repository', () => ({
  userAuthAccountRepository: {
    findByProviderAccount: repositoryMocks.findAuthAccountByProviderAccount,
    upsertByProviderAccount: repositoryMocks.upsertAuthAccountByProviderAccount
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
    repositoryMocks.findByPhone.mockReset();
    repositoryMocks.findByTelegramUserId.mockReset();
    repositoryMocks.createUser.mockReset();
    repositoryMocks.updateUser.mockReset();
    repositoryMocks.updateLastLogin.mockReset();
    repositoryMocks.findAuthAccountByProviderAccount.mockReset();
    repositoryMocks.upsertAuthAccountByProviderAccount.mockReset();
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

  it('creates a Bale-linked user and session on first login', async () => {
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue(null);
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.findByTelegramUserId.mockResolvedValue(null);
    repositoryMocks.createUser.mockResolvedValue({
      id: 'user-1',
      displayName: 'Bale User',
      firstName: 'Bale',
      lastName: 'User',
      email: 'bale@example.com',
      phone: '09120000000',
      avatarUrl: 'https://example.com/avatar.png',
      telegramUserId: '42',
      telegramUsername: 'bale-user',
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-1',
      userId: 'user-1',
      provider: 'BALE',
      providerAccountId: '42'
    });
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

    const result = await authService.authenticateWithBale({
      baleUser: {
        id: '42',
        username: 'bale-user',
        firstName: 'Bale',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar.png'
      },
      email: 'bale@example.com',
      phone: '09120000000',
      sessionContext: {
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    });

    expect(repositoryMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'bale@example.com',
        phone: '09120000000',
        telegramUserId: '42',
        telegramUsername: 'bale-user'
      })
    );
    expect(repositoryMocks.upsertAuthAccountByProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAccountId: '42',
        userId: 'user-1'
      })
    );
    expect(result.isNewUser).toBe(true);
    expect(result.isNewAuthAccount).toBe(true);
    expect(result.user?.telegramUserId).toBe('42');
    expect(result.session?.userId).toBe('user-1');
  });

  it('links a Bale account to an existing email user without creating a duplicate user', async () => {
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue({
      id: 'user-existing',
      displayName: 'Existing User',
      firstName: null,
      lastName: null,
      email: 'existing@example.com',
      phone: null,
      avatarUrl: null,
      telegramUserId: null,
      telegramUsername: null,
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.findByTelegramUserId.mockResolvedValue(null);
    repositoryMocks.updateUser.mockResolvedValue({
      id: 'user-existing',
      displayName: 'Existing User',
      firstName: 'Bale',
      lastName: 'Linked',
      email: 'existing@example.com',
      phone: null,
      avatarUrl: null,
      telegramUserId: '9001',
      telegramUsername: 'linked-user',
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-existing',
      userId: 'user-existing',
      provider: 'BALE',
      providerAccountId: '9001'
    });
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-existing',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);

    const result = await authService.authenticateWithBale({
      baleUser: {
        id: '9001',
        username: 'linked-user',
        firstName: 'Bale',
        lastName: 'Linked'
      },
      email: 'existing@example.com'
    });

    expect(repositoryMocks.createUser).not.toHaveBeenCalled();
    expect(repositoryMocks.updateUser).toHaveBeenCalledWith(
      'user-existing',
      expect.objectContaining({
        telegramUserId: '9001',
        telegramUsername: 'linked-user'
      })
    );
    expect(result.isNewUser).toBe(false);
    expect(result.isNewAuthAccount).toBe(true);
    expect(result.user?.id).toBe('user-existing');
  });

  it('reuses an existing Bale auth account without creating a duplicate user', async () => {
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-existing',
      userId: 'user-1',
      provider: 'BALE',
      providerAccountId: '42'
    });
    repositoryMocks.findById.mockResolvedValue({
      id: 'user-1',
      displayName: 'Existing Bale User',
      firstName: 'Existing',
      lastName: 'User',
      email: 'bale@example.com',
      phone: null,
      avatarUrl: null,
      telegramUserId: '42',
      telegramUsername: 'existing-user',
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.findByEmail.mockResolvedValue(null);
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.findByTelegramUserId.mockResolvedValue(null);
    repositoryMocks.updateUser.mockResolvedValue({
      id: 'user-1',
      displayName: 'Existing Bale User',
      firstName: 'Existing',
      lastName: 'User',
      email: 'bale@example.com',
      phone: null,
      avatarUrl: null,
      telegramUserId: '42',
      telegramUsername: 'existing-user',
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-existing',
      userId: 'user-1',
      provider: 'BALE',
      providerAccountId: '42'
    });
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);

    const result = await authService.authenticateWithBale({
      baleUser: {
        id: '42',
        username: 'existing-user'
      },
      email: 'bale@example.com'
    });

    expect(repositoryMocks.createUser).not.toHaveBeenCalled();
    expect(repositoryMocks.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        telegramUserId: '42',
        telegramUsername: 'existing-user'
      })
    );
    expect(result.isNewUser).toBe(false);
    expect(result.isNewAuthAccount).toBe(false);
    expect(result.user?.id).toBe('user-1');
  });
});
