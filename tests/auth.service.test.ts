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
  createOtpCode: vi.fn(),
  consumeOtpCode: vi.fn(),
  consumeActiveOtpCodesForTarget: vi.fn(),
  findLatestActiveOtpCodeByTarget: vi.fn(),
  findLatestOtpCodeByTarget: vi.fn(),
  findAuthAccountByProviderAccount: vi.fn(),
  upsertAuthAccountByProviderAccount: vi.fn()
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(() => 'google-jwks')
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

vi.mock('../src/repositories/otpCode.repository', () => ({
  otpCodeRepository: {
    create: repositoryMocks.createOtpCode,
    consume: repositoryMocks.consumeOtpCode,
    consumeActiveForTarget: repositoryMocks.consumeActiveOtpCodesForTarget,
    findLatestActiveByTarget: repositoryMocks.findLatestActiveOtpCodeByTarget,
    findLatestByTarget: repositoryMocks.findLatestOtpCodeByTarget
  }
}));

vi.mock('../src/config/env', async () => {
  const actual = await vi.importActual<typeof import('../src/config/env')>(
    '../src/config/env'
  );

  return {
    env: {
      ...actual.env,
      GOOGLE_CLIENT_ID: 'google-client-id-1',
      TELEGRAM_BOT_TOKEN: 'telegram-bot-token-1',
      AUTH_EMAIL_OTP_TTL_MINUTES: 10,
      AUTH_EMAIL_OTP_COOLDOWN_SECONDS: 60,
      AUTH_EMAIL_OTP_LENGTH: 6,
      AUTH_EMAIL_OTP_FIXED_CODE: '',
      MAILTRAP_HOST: 'sandbox.smtp.mailtrap.io',
      MAILTRAP_PORT: 587,
      MAILTRAP_USER: 'mailtrap-user',
      MAILTRAP_PASS: 'mailtrap-pass',
      MAILTRAP_SECURE: false,
      MAILTRAP_FROM_EMAIL: 'auth@example.com',
      MAILTRAP_FROM_NAME: 'Market Auth'
    }
  };
});

vi.mock('jose', () => ({
  jwtVerify: joseMocks.jwtVerify,
  createRemoteJWKSet: joseMocks.createRemoteJWKSet
}));

import {
  authService,
  extractBearerToken,
  hashSessionToken
} from '../src/services/auth.service';
import { env } from '../src/config/env';

describe('auth.service', () => {
  beforeEach(() => {
    env.NODE_ENV = 'test';
    env.AUTH_EMAIL_OTP_FIXED_CODE = '';
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
    repositoryMocks.createOtpCode.mockReset();
    repositoryMocks.consumeOtpCode.mockReset();
    repositoryMocks.consumeActiveOtpCodesForTarget.mockReset();
    repositoryMocks.findLatestActiveOtpCodeByTarget.mockReset();
    repositoryMocks.findLatestOtpCodeByTarget.mockReset();
    repositoryMocks.findAuthAccountByProviderAccount.mockReset();
    repositoryMocks.upsertAuthAccountByProviderAccount.mockReset();
    joseMocks.jwtVerify.mockReset();
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

  it('creates a Telegram-linked user and session on first login', async () => {
    const authDate = Math.floor(Date.now() / 1000);
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue(null);
    repositoryMocks.findByTelegramUserId.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue(null);
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.createUser.mockResolvedValue({
      id: 'user-telegram',
      displayName: 'Telegram',
      firstName: 'Telegram',
      lastName: null,
      email: null,
      phone: null,
      avatarUrl: null,
      telegramUserId: '12345',
      telegramUsername: 'tg-user',
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-telegram',
      userId: 'user-telegram',
      provider: 'TELEGRAM',
      providerAccountId: '12345'
    });
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-telegram',
      userId: 'user-telegram',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);

    const crypto = await import('node:crypto');
    const secretKey = crypto
      .createHash('sha256')
      .update('telegram-bot-token-1')
      .digest();
    const checkString = [
      `auth_date=${authDate}`,
      'first_name=Telegram',
      'id=12345',
      'username=tg-user'
    ].join('\n');
    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    const result = await authService.authenticateWithTelegram({
      telegramUser: {
        id: '12345',
        firstName: 'Telegram',
        username: 'tg-user',
        authDate,
        hash
      }
    });

    expect(repositoryMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramUserId: '12345',
        telegramUsername: 'tg-user'
      })
    );
    expect(repositoryMocks.upsertAuthAccountByProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'TELEGRAM',
        providerAccountId: '12345'
      })
    );
    expect(result.user?.telegramUserId).toBe('12345');
  });

  it('creates a Google-linked user and session on first login', async () => {
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-sub-1',
        email: 'google@example.com',
        email_verified: true,
        name: 'Google User',
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://example.com/google.png',
        nonce: 'nonce-1'
      }
    });
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue(null);
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.createUser.mockResolvedValue({
      id: 'user-google',
      displayName: 'Google User',
      firstName: 'Google',
      lastName: 'User',
      email: 'google@example.com',
      phone: null,
      avatarUrl: 'https://example.com/google.png',
      telegramUserId: null,
      telegramUsername: null,
      isActive: true,
      trialUsed: false,
      lastLoginAt: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-google',
      userId: 'user-google',
      provider: 'GOOGLE',
      providerAccountId: 'google-sub-1'
    });
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-google',
      userId: 'user-google',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);

    const result = await authService.authenticateWithGoogle({
      idToken: 'google-id-token',
      nonce: 'nonce-1'
    });

    expect(joseMocks.jwtVerify).toHaveBeenCalledWith(
      'google-id-token',
      'google-jwks',
      expect.objectContaining({
        audience: 'google-client-id-1'
      })
    );
    expect(repositoryMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'google@example.com'
      })
    );
    expect(repositoryMocks.upsertAuthAccountByProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'GOOGLE',
        providerAccountId: 'google-sub-1'
      })
    );
    expect(result.user?.email).toBe('google@example.com');
  });

  it('creates an email OTP without sending an email', async () => {
    repositoryMocks.findLatestOtpCodeByTarget.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue({
      id: 'user-1'
    });
    repositoryMocks.consumeActiveOtpCodesForTarget.mockResolvedValue({ count: 0 });
    repositoryMocks.createOtpCode.mockResolvedValue({
      id: 'otp-1'
    });

    const result = await authService.requestEmailLoginOtp({
      email: 'USER@example.com'
    });

    expect(repositoryMocks.createOtpCode).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        channel: 'EMAIL',
        target: 'user@example.com',
        purpose: 'LOGIN',
        codeHash: expect.any(String),
        expiresAt: expect.any(Date)
      })
    );
    expect(result.email).toBe('user@example.com');
    expect(result.otpCode).toMatch(/^\d{6}$/);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it('uses the configured fixed email OTP code', async () => {
    env.AUTH_EMAIL_OTP_FIXED_CODE = '123456';
    repositoryMocks.findLatestOtpCodeByTarget.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue({
      id: 'user-1'
    });
    repositoryMocks.consumeActiveOtpCodesForTarget.mockResolvedValue({ count: 0 });
    repositoryMocks.createOtpCode.mockResolvedValue({
      id: 'otp-fixed'
    });

    const result = await authService.requestEmailLoginOtp({
      email: 'user@example.com'
    });

    expect(result.otpCode).toBe('123456');
  });

  it('rejects email OTP requests during cooldown', async () => {
    repositoryMocks.findLatestOtpCodeByTarget.mockResolvedValue({
      id: 'otp-1',
      consumedAt: null,
      createdAt: new Date(Date.now() - 10 * 1000)
    });

    await expect(
      authService.requestEmailLoginOtp({
        email: 'user@example.com'
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      payload: expect.objectContaining({
        englishMessage: 'OTP was requested too recently'
      })
    });
  });

  it('skips email OTP cooldown checks in development', async () => {
    env.NODE_ENV = 'development';
    repositoryMocks.findLatestOtpCodeByTarget.mockResolvedValue({
      id: 'otp-1',
      consumedAt: null,
      createdAt: new Date(Date.now() - 10 * 1000)
    });
    repositoryMocks.findByEmail.mockResolvedValue({
      id: 'user-1'
    });
    repositoryMocks.consumeActiveOtpCodesForTarget.mockResolvedValue({ count: 0 });
    repositoryMocks.createOtpCode.mockResolvedValue({
      id: 'otp-2'
    });

    await expect(
      authService.requestEmailLoginOtp({
        email: 'user@example.com'
      })
    ).resolves.toMatchObject({
      email: 'user@example.com',
      otpCode: expect.stringMatching(/^\d{6}$/),
      retryAfterSeconds: 60
    });
  });

  it('verifies an email OTP and creates an auth session', async () => {
    const email = 'user@example.com';
    const code = '123456';

    repositoryMocks.findLatestActiveOtpCodeByTarget.mockResolvedValue({
      id: 'otp-1',
      userId: null,
      codeHash: (await import('node:crypto'))
        .createHash('sha256')
        .update(`EMAIL:${email}:${code}`)
        .digest('hex')
    });
    repositoryMocks.findAuthAccountByProviderAccount.mockResolvedValue(null);
    repositoryMocks.findByEmail.mockResolvedValue(null);
    repositoryMocks.findByPhone.mockResolvedValue(null);
    repositoryMocks.createUser.mockResolvedValue({
      id: 'user-email',
      displayName: 'Email User',
      firstName: null,
      lastName: null,
      email,
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
    repositoryMocks.upsertAuthAccountByProviderAccount.mockResolvedValue({
      id: 'auth-email',
      userId: 'user-email',
      provider: 'EMAIL',
      providerAccountId: email
    });
    repositoryMocks.createSession.mockResolvedValue({
      id: 'session-email',
      userId: 'user-email',
      tokenHash: 'stored-hash',
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      revokedAt: null,
      ip: null,
      userAgent: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z')
    });
    repositoryMocks.updateLastLogin.mockResolvedValue(null);
    repositoryMocks.consumeOtpCode.mockResolvedValue({
      id: 'otp-1'
    });

    const result = await authService.verifyEmailLoginOtp({
      email,
      code,
      displayName: 'Email User'
    });

    expect(repositoryMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        displayName: 'Email User'
      })
    );
    expect(repositoryMocks.upsertAuthAccountByProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'EMAIL',
        providerAccountId: email
      })
    );
    expect(repositoryMocks.consumeOtpCode).toHaveBeenCalledWith('otp-1');
    expect(result.user?.email).toBe(email);
  });
});
