import { createHash, randomBytes } from 'crypto';

import type { AuthProvider } from '@prisma/client';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
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

const normalizeNullableString = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  throw new AppError('حساب بله با کاربر دیگری در تعارض است.', 409, {
    englishMessage: reason
  });
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
      throw new AppError('شناسه کاربر بله معتبر نیست.', 400, {
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
      throw new AppError('کاربر یافت نشد.', 404, {
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
      throw new AppError('کاربر یافت نشد.', 404, {
        englishMessage: 'User not found'
      });
    }

    return toAuthenticatedUser(user);
  }
};
