import { createHash, randomBytes } from 'crypto';
import crypto from 'node:crypto';

import type { AuthProvider, OtpChannel, OtpPurpose, Prisma } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';
import { otpCodeRepository } from '../repositories/otpCode.repository';
import { sessionRepository } from '../repositories/session.repository';
import { userAuthAccountRepository } from '../repositories/userAuthAccount.repository';
import { userRepository } from '../repositories/user.repository';
import type {
  AuthContext,
  AuthenticatedSession,
  AuthenticatedUser,
  SessionContext
} from '../types/auth';

const SESSION_TOKEN_BYTES = 32;
const BEARER_PREFIX = 'Bearer ';
const BALE_AUTH_PROVIDER = 'BALE' as AuthProvider;
const EMAIL_AUTH_PROVIDER = 'EMAIL' as AuthProvider;
const GOOGLE_AUTH_PROVIDER = 'GOOGLE' as AuthProvider;
const TELEGRAM_AUTH_PROVIDER = 'TELEGRAM' as AuthProvider;
const OTP_CHANNEL_EMAIL = 'EMAIL' as OtpChannel;
const OTP_PURPOSE_LOGIN = 'LOGIN' as OtpPurpose;
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);
const TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

type BaleAuthUserInput = {
  id: string;
  username?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  avatarUrl?: string | null | undefined;
};

type BaleAuthenticateInput = {
  baleUser: BaleAuthUserInput;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  displayName?: string | null | undefined;
  currentUserId?: string | null | undefined;
  sessionContext?: SessionContext | undefined;
};

type TelegramAuthUserInput = {
  id: string;
  firstName: string;
  lastName?: string | null | undefined;
  username?: string | null | undefined;
  photoUrl?: string | null | undefined;
  authDate: number;
  hash: string;
};

type TelegramAuthenticateInput = {
  telegramUser: TelegramAuthUserInput;
  currentUserId?: string | null | undefined;
  sessionContext?: SessionContext | undefined;
};

type GoogleAuthenticateInput = {
  idToken: string;
  nonce?: string | null | undefined;
  currentUserId?: string | null | undefined;
  sessionContext?: SessionContext | undefined;
};

type RequestEmailOtpInput = {
  email: string;
};

type VerifyEmailOtpInput = {
  email: string;
  code: string;
  displayName?: string | null | undefined;
  currentUserId?: string | null | undefined;
  sessionContext?: SessionContext | undefined;
};

type ExternalAccountInput = {
  provider: AuthProvider;
  providerAccountId: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  displayName?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  username?: string | null | undefined;
  currentUserId?: string | null | undefined;
  sessionContext?: SessionContext | undefined;
  userUpdates?: {
    telegramUserId?: string | null | undefined;
    telegramUsername?: string | null | undefined;
  };
  metadata?: Record<string, unknown> | undefined;
};

const normalizeNullableString = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hashOtpCode = (input: { channel: OtpChannel; target: string; code: string }) => {
  return createHash('sha256')
    .update(`${input.channel}:${input.target}:${input.code}`)
    .digest('hex');
};

const generateNumericOtp = (length: number) => {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  return String(crypto.randomInt(min, max));
};

const constantTimeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildDisplayName = (input: {
  displayName?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  username?: string | null | undefined;
}) => {
  const explicitDisplayName = normalizeNullableString(input.displayName);
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const parts = [
    normalizeNullableString(input.firstName),
    normalizeNullableString(input.lastName)
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return normalizeNullableString(input.username);
};

const throwIdentityConflict = (reason: string) => {
  throw new AppError('Ø­Ø³Ø§Ø¨ Ø¨Ù„Ù‡ Ø¨Ø§ Ú©Ø§Ø±Ø¨Ø± Ø¯ÛŒÚ¯Ø±ÛŒ Ø¯Ø± ØªØ¹Ø§Ø±Ø¶ Ø§Ø³Øª.', 409, {
    englishMessage: reason
  });
};

const hashTelegramAuthSecret = (botToken: string) => {
  return crypto.createHash('sha256').update(botToken).digest();
};

const buildTelegramCheckString = (payload: TelegramAuthUserInput) => {
  const pairs = Object.entries({
    auth_date: String(payload.authDate),
    first_name: payload.firstName,
    id: payload.id,
    last_name: payload.lastName ?? undefined,
    photo_url: payload.photoUrl ?? undefined,
    username: payload.username ?? undefined
  })
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, value]) => `${key}=${value}`);

  return pairs.join('\n');
};

const verifyTelegramAuthPayload = (payload: TelegramAuthUserInput) => {
  const botToken = env.TELEGRAM_BOT_TOKEN.trim();
  if (!botToken) {
    throw new AppError('Telegram auth is not configured', 500, {
      englishMessage: 'Telegram auth is not configured'
    });
  }

  const checkString = buildTelegramCheckString(payload);
  const secret = hashTelegramAuthSecret(botToken);
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(checkString)
    .digest('hex');

  if (expectedHash !== payload.hash) {
    throw new AppError('Ø§Ø·Ù„Ø§Ø¹Ø§Øª ÙˆØ±ÙˆØ¯ ØªÙ„Ú¯Ø±Ø§Ù… Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
      englishMessage: 'Invalid Telegram auth signature'
    });
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - payload.authDate;
  if (ageSeconds < 0 || ageSeconds > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    throw new AppError('Ø§Ø·Ù„Ø§Ø¹Ø§Øª ÙˆØ±ÙˆØ¯ ØªÙ„Ú¯Ø±Ø§Ù… Ù…Ù†Ù‚Ø¶ÛŒ Ø´Ø¯Ù‡ Ø§Ø³Øª.', 401, {
      englishMessage: 'Telegram auth data is expired'
    });
  }
};

const verifyGoogleIdToken = async (input: {
  idToken: string;
  nonce?: string | null | undefined;
}) => {
  const clientId = env.GOOGLE_CLIENT_ID.trim();
  if (!clientId) {
    throw new AppError('Google auth is not configured', 500, {
      englishMessage: 'Google auth is not configured'
    });
  }

  try {
    const { payload } = await jwtVerify(input.idToken, GOOGLE_JWKS, {
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com']
    });

    logger.info(
      {
        provider: 'GOOGLE',
        audience: payload.aud,
        issuer: payload.iss,
        subject: payload.sub,
        email:
          typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
        hasNonce: typeof payload.nonce === 'string',
        nonceMatched: input.nonce ? payload.nonce === input.nonce : null,
        issuedAt: payload.iat ?? null,
        expiresAt: payload.exp ?? null,
        nowEpochSeconds: Math.floor(Date.now() / 1000)
      },
      'Google ID token verified successfully'
    );

    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      throw new AppError('Ø´Ù†Ø§Ø³Ù‡ Ú©Ø§Ø±Ø¨Ø± Ú¯ÙˆÚ¯Ù„ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
        englishMessage: 'Google subject is missing'
      });
    }

    if (input.nonce && payload.nonce !== input.nonce) {
      throw new AppError('nonce ÙˆØ±ÙˆØ¯ Ú¯ÙˆÚ¯Ù„ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
        englishMessage: 'Google nonce is invalid'
      });
    }

    const email =
      typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    const emailVerified =
      typeof payload.email_verified === 'boolean'
        ? payload.email_verified
        : payload.email_verified === 'true';

    if (email && !emailVerified) {
      throw new AppError('Ø§ÛŒÙ…ÛŒÙ„ Ø­Ø³Ø§Ø¨ Ú¯ÙˆÚ¯Ù„ ØªØ§ÛŒÛŒØ¯ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.', 401, {
        englishMessage: 'Google email is not verified'
      });
    }

    return {
      providerAccountId: payload.sub,
      email,
      displayName: typeof payload.name === 'string' ? payload.name : null,
      firstName: typeof payload.given_name === 'string' ? payload.given_name : null,
      lastName: typeof payload.family_name === 'string' ? payload.family_name : null,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : null
    };
  } catch (error) {
    logger.error(
      {
        provider: 'GOOGLE',
        err: error,
        googleClientIdConfigured: clientId,
        nonceProvided: input.nonce ?? null,
        idTokenPreview: input.idToken.slice(0, 32),
        idTokenLength: input.idToken.length
      },
      'Google ID token verification failed'
    );

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('ØªÙˆÚ©Ù† ÙˆØ±ÙˆØ¯ Ú¯ÙˆÚ¯Ù„ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
      englishMessage: 'Invalid Google ID token'
    });
  }
};

const ensureUniqueUserMatch = (
  users: Array<
    | Awaited<ReturnType<typeof userRepository.findById>>
    | Awaited<ReturnType<typeof userRepository.findByEmail>>
  >
) => {
  const distinctUsers = new Map(
    users
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => [user.id, user])
  );

  if (distinctUsers.size > 1) {
    throwIdentityConflict('Bale identity matches multiple existing users');
  }

  return [...distinctUsers.values()][0] ?? null;
};

const authenticateExternalAccount = async (
  service: typeof authService,
  input: ExternalAccountInput
) => {
  const providerAccountId = normalizeNullableString(input.providerAccountId);
  if (!providerAccountId) {
    throw new AppError('Ø´Ù†Ø§Ø³Ù‡ Ø­Ø³Ø§Ø¨ Ø®Ø§Ø±Ø¬ÛŒ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 400, {
      englishMessage: 'External provider account id is required'
    });
  }

  const email = normalizeNullableString(input.email)?.toLowerCase() ?? null;
  const phone = normalizeNullableString(input.phone);
  const username = normalizeNullableString(input.username);
  const firstName = normalizeNullableString(input.firstName);
  const lastName = normalizeNullableString(input.lastName);
  const avatarUrl = normalizeNullableString(input.avatarUrl);
  const displayName = buildDisplayName({
    displayName: input.displayName,
    firstName,
    lastName,
    username
  });

  const linkedAccount = await userAuthAccountRepository.findByProviderAccount(
    input.provider,
    providerAccountId
  );

  const currentUser = input.currentUserId
    ? await userRepository.findById(input.currentUserId)
    : null;

  if (input.currentUserId && !currentUser) {
    throw new AppError('Ú©Ø§Ø±Ø¨Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯.', 404, {
      englishMessage: 'Current user not found'
    });
  }

  if (
    currentUser &&
    linkedAccount &&
    linkedAccount.userId !== currentUser.id
  ) {
    throwIdentityConflict(
      `${input.provider} account is already linked to another user`
    );
  }

  const emailUser = email ? await userRepository.findByEmail(email) : null;
  const phoneUser = phone ? await userRepository.findByPhone(phone) : null;
  const legacyTelegramUser =
    input.provider === TELEGRAM_AUTH_PROVIDER
      ? await userRepository.findByTelegramUserId(providerAccountId)
      : null;

  const targetUser =
    currentUser ??
    (linkedAccount ? await userRepository.findById(linkedAccount.userId) : null) ??
    ensureUniqueUserMatch([emailUser, phoneUser, legacyTelegramUser]);

  if (emailUser && targetUser && emailUser.id !== targetUser.id) {
    throwIdentityConflict('Email belongs to another user');
  }

  if (phoneUser && targetUser && phoneUser.id !== targetUser.id) {
    throwIdentityConflict('Phone belongs to another user');
  }

  const providerUserUpdates = input.userUpdates ?? {};

  let user =
    targetUser ??
    (await userRepository.create({
      displayName,
      firstName,
      lastName,
      email,
      phone,
      avatarUrl,
      ...(providerUserUpdates.telegramUserId !== undefined
        ? { telegramUserId: providerUserUpdates.telegramUserId }
        : {}),
      ...(providerUserUpdates.telegramUsername !== undefined
        ? { telegramUsername: providerUserUpdates.telegramUsername }
        : {})
    }));

  if (targetUser) {
    user = await userRepository.update(targetUser.id, {
      displayName: displayName ?? targetUser.displayName,
      firstName: firstName ?? targetUser.firstName,
      lastName: lastName ?? targetUser.lastName,
      email: email ?? targetUser.email,
      phone: phone ?? targetUser.phone,
      avatarUrl: avatarUrl ?? targetUser.avatarUrl,
      ...(providerUserUpdates.telegramUserId !== undefined
        ? { telegramUserId: providerUserUpdates.telegramUserId }
        : {}),
      ...(providerUserUpdates.telegramUsername !== undefined
        ? {
            telegramUsername:
              providerUserUpdates.telegramUsername ?? targetUser.telegramUsername
          }
        : {})
    });
  }

  const authAccount = await userAuthAccountRepository.upsertByProviderAccount({
    userId: user.id,
    provider: input.provider,
    providerAccountId,
    providerEmail: email,
    providerPhone: phone,
    ...(input.metadata !== undefined
      ? { metadata: input.metadata as Prisma.InputJsonObject }
      : {})
  });

  const { token, session } = await service.createSession(
    user.id,
    input.sessionContext
  );

  return {
    token,
    session,
    user: toAuthenticatedUser(user),
    authAccount,
    isNewUser: !targetUser,
    isNewAuthAccount: !linkedAccount
  };
};

const toAuthenticatedUser = (user: Awaited<ReturnType<typeof userRepository.findById>>): AuthenticatedUser | null => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    telegramUserId: user.telegramUserId,
    telegramUsername: user.telegramUsername,
    isActive: user.isActive,
    trialUsed: user.trialUsed,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const toAuthenticatedSession = (
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null
): AuthenticatedSession | null => {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    ip: session.ip,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
};

const buildAnonymousAuthContext = (): AuthContext => {
  return {
    token: null,
    user: null,
    session: null,
    isAuthenticated: false
  };
};

export const extractBearerToken = (
  authorizationHeader: string | undefined
): string | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

export const hashSessionToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

export const authService = {
  buildAnonymousAuthContext,

  generateSessionToken() {
    return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  },

  async createSession(userId: string, context: SessionContext = {}) {
    const token = this.generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const session = await sessionRepository.create({
      userId,
      tokenHash,
      expiresAt,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null
    });

    await userRepository.updateLastLogin(userId);

    return {
      token,
      session: toAuthenticatedSession(session)
    };
  },

  async authenticateWithBale(input: BaleAuthenticateInput) {
    const providerAccountId = normalizeNullableString(input.baleUser.id);
    if (!providerAccountId) {
      throw new AppError('Ø´Ù†Ø§Ø³Ù‡ Ú©Ø§Ø±Ø¨Ø± Ø¨Ù„Ù‡ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 400, {
        englishMessage: 'Bale user id is required'
      });
    }

    const email = normalizeNullableString(input.email)?.toLowerCase() ?? null;
    const phone = normalizeNullableString(input.phone);
    const username = normalizeNullableString(input.baleUser.username);
    const firstName = normalizeNullableString(input.baleUser.firstName);
    const lastName = normalizeNullableString(input.baleUser.lastName);
    const avatarUrl = normalizeNullableString(input.baleUser.avatarUrl);
    const displayName = buildDisplayName({
      displayName: input.displayName,
      firstName,
      lastName,
      username
    });

    const linkedAccount = await userAuthAccountRepository.findByProviderAccount(
      BALE_AUTH_PROVIDER,
      providerAccountId
    );

    const currentUser = input.currentUserId
      ? await userRepository.findById(input.currentUserId)
      : null;

    if (input.currentUserId && !currentUser) {
      throw new AppError('Ú©Ø§Ø±Ø¨Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯.', 404, {
        englishMessage: 'Current user not found'
      });
    }

    if (
      currentUser &&
      linkedAccount &&
      linkedAccount.userId !== currentUser.id
    ) {
      throwIdentityConflict('Bale account is already linked to another user');
    }

    const emailUser = email ? await userRepository.findByEmail(email) : null;
    const phoneUser = phone ? await userRepository.findByPhone(phone) : null;
    const legacyBaleUser = await userRepository.findByTelegramUserId(
      providerAccountId
    );

    const targetUser =
      currentUser ??
      (linkedAccount ? await userRepository.findById(linkedAccount.userId) : null) ??
      ensureUniqueUserMatch([emailUser, phoneUser, legacyBaleUser]);

    if (emailUser && targetUser && emailUser.id !== targetUser.id) {
      throwIdentityConflict('Email belongs to another user');
    }

    if (phoneUser && targetUser && phoneUser.id !== targetUser.id) {
      throwIdentityConflict('Phone belongs to another user');
    }

    let user =
      targetUser ??
      (await userRepository.create({
        displayName,
        firstName,
        lastName,
        email,
        phone,
        avatarUrl,
        telegramUserId: providerAccountId,
        telegramUsername: username
      }));

    if (targetUser) {
      user = await userRepository.update(targetUser.id, {
        displayName: displayName ?? targetUser.displayName,
        firstName: firstName ?? targetUser.firstName,
        lastName: lastName ?? targetUser.lastName,
        email: email ?? targetUser.email,
        phone: phone ?? targetUser.phone,
        avatarUrl: avatarUrl ?? targetUser.avatarUrl,
        telegramUserId: providerAccountId,
        telegramUsername: username ?? targetUser.telegramUsername
      });
    }

    const authAccount = await userAuthAccountRepository.upsertByProviderAccount({
      userId: user.id,
      provider: BALE_AUTH_PROVIDER,
      providerAccountId,
      providerEmail: email,
      providerPhone: phone,
      metadata: {
        username,
        firstName,
        lastName,
        avatarUrl,
        displayName
      }
    });

    const { token, session } = await this.createSession(
      user.id,
      input.sessionContext
    );

    return {
      token,
      session,
      user: toAuthenticatedUser(user),
      authAccount,
      isNewUser: !targetUser,
      isNewAuthAccount: !linkedAccount
    };
  },

  async authenticateWithTelegram(input: TelegramAuthenticateInput) {
    verifyTelegramAuthPayload(input.telegramUser);

    return authenticateExternalAccount(this, {
      provider: TELEGRAM_AUTH_PROVIDER,
      providerAccountId: input.telegramUser.id,
      firstName: input.telegramUser.firstName,
      lastName: input.telegramUser.lastName,
      username: input.telegramUser.username,
      avatarUrl: input.telegramUser.photoUrl,
      currentUserId: input.currentUserId,
      sessionContext: input.sessionContext,
      userUpdates: {
        telegramUserId: input.telegramUser.id,
        telegramUsername: input.telegramUser.username ?? null
      },
      metadata: {
        username: input.telegramUser.username ?? null,
        firstName: input.telegramUser.firstName,
        lastName: input.telegramUser.lastName ?? null,
        photoUrl: input.telegramUser.photoUrl ?? null,
        authDate: input.telegramUser.authDate
      }
    });
  },

  async authenticateWithGoogle(input: GoogleAuthenticateInput) {
    const verified = await verifyGoogleIdToken({
      idToken: input.idToken,
      nonce: input.nonce
    });

    return authenticateExternalAccount(this, {
      provider: GOOGLE_AUTH_PROVIDER,
      providerAccountId: verified.providerAccountId,
      email: verified.email,
      displayName: verified.displayName,
      firstName: verified.firstName,
      lastName: verified.lastName,
      avatarUrl: verified.avatarUrl,
      currentUserId: input.currentUserId,
      sessionContext: input.sessionContext,
      metadata: {
        email: verified.email,
        name: verified.displayName,
        givenName: verified.firstName,
        familyName: verified.lastName,
        picture: verified.avatarUrl
      }
    });
  },

  async requestEmailLoginOtp(input: RequestEmailOtpInput) {
    const email = normalizeNullableString(input.email)?.toLowerCase();
    if (!email) {
      throw new AppError('ایمیل معتبر لازم است.', 400, {
        englishMessage: 'Email is required'
      });
    }

    const now = new Date();
    const latestOtp = await otpCodeRepository.findLatestByTarget(
      OTP_CHANNEL_EMAIL,
      email,
      OTP_PURPOSE_LOGIN
    );

    if (env.NODE_ENV !== 'development') {
      if (
        latestOtp &&
        latestOtp.consumedAt === null &&
        latestOtp.createdAt.getTime() + env.AUTH_EMAIL_OTP_COOLDOWN_SECONDS * 1000 >
          now.getTime()
      ) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(
            (latestOtp.createdAt.getTime() +
              env.AUTH_EMAIL_OTP_COOLDOWN_SECONDS * 1000 -
              now.getTime()) /
              1000
          )
        );

        throw new AppError('درخواست کد ورود زودتر از حد مجاز است.', 429, {
          englishMessage: 'OTP was requested too recently',
          retryAfterSeconds
        });
      }
    }

    const user = await userRepository.findByEmail(email);
    const code =
      env.AUTH_EMAIL_OTP_FIXED_CODE || generateNumericOtp(env.AUTH_EMAIL_OTP_LENGTH);
    const expiresAt = new Date(
      now.getTime() + env.AUTH_EMAIL_OTP_TTL_MINUTES * 60 * 1000
    );

    await otpCodeRepository.consumeActiveForTarget(
      OTP_CHANNEL_EMAIL,
      email,
      OTP_PURPOSE_LOGIN,
      now
    );

    await otpCodeRepository.create({
      userId: user?.id ?? null,
      channel: OTP_CHANNEL_EMAIL,
      target: email,
      codeHash: hashOtpCode({
        channel: OTP_CHANNEL_EMAIL,
        target: email,
        code
      }),
      purpose: OTP_PURPOSE_LOGIN,
      expiresAt
    });

    return {
      email,
      otpCode: code,
      expiresAt,
      retryAfterSeconds: env.AUTH_EMAIL_OTP_COOLDOWN_SECONDS
    };
  },

  async verifyEmailLoginOtp(input: VerifyEmailOtpInput) {
    const email = normalizeNullableString(input.email)?.toLowerCase();
    const code = normalizeNullableString(input.code);

    if (!email || !code) {
      throw new AppError('ایمیل و کد ورود معتبر لازم است.', 400, {
        englishMessage: 'Email and OTP code are required'
      });
    }

    const otp = await otpCodeRepository.findLatestActiveByTarget(
      OTP_CHANNEL_EMAIL,
      email,
      OTP_PURPOSE_LOGIN
    );

    if (
      !otp ||
      !constantTimeEquals(
        otp.codeHash,
        hashOtpCode({
          channel: OTP_CHANNEL_EMAIL,
          target: email,
          code
        })
      )
    ) {
      throw new AppError('کد ورود ایمیل معتبر نیست.', 401, {
        englishMessage: 'Invalid email OTP'
      });
    }

    const result = await authenticateExternalAccount(this, {
      provider: EMAIL_AUTH_PROVIDER,
      providerAccountId: email,
      email,
      displayName: input.displayName,
      currentUserId: input.currentUserId,
      sessionContext: input.sessionContext,
      metadata: {
        email
      }
    });

    await otpCodeRepository.consume(otp.id);

    return result;
  },

  async revokeSession(sessionId: string) {
    return sessionRepository.revokeById(sessionId);
  },

  async getAuthContextFromToken(token: string): Promise<AuthContext> {
    const tokenHash = hashSessionToken(token);
    const sessionRecord = await sessionRepository.findActiveByTokenHash(tokenHash);

    if (!sessionRecord || !sessionRecord.user.isActive) {
      return {
        token,
        user: null,
        session: null,
        isAuthenticated: false
      };
    }

    return {
      token,
      user: toAuthenticatedUser(sessionRecord.user),
      session: toAuthenticatedSession(sessionRecord),
      isAuthenticated: true
    };
  },

  async requireUser(id: string) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('Ú©Ø§Ø±Ø¨Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯.', 404, {
        englishMessage: 'User not found'
      });
    }

    return toAuthenticatedUser(user);
  }
};


