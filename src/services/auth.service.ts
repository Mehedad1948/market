import { createHash, randomBytes } from 'crypto';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { sessionRepository } from '../repositories/session.repository';
import { userRepository } from '../repositories/user.repository';
import type {
  AuthContext,
  AuthenticatedSession,
  AuthenticatedUser,
  SessionContext
} from '../types/auth';

const SESSION_TOKEN_BYTES = 32;
const BEARER_PREFIX = 'Bearer ';

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
