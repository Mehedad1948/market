import type { User, UserSession } from '@prisma/client';

export type AuthenticatedUser = Pick<
  User,
  | 'id'
  | 'displayName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'avatarUrl'
  | 'telegramUserId'
  | 'telegramUsername'
  | 'isActive'
  | 'trialUsed'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
>;

export type AuthenticatedSession = Pick<
  UserSession,
  'id' | 'userId' | 'expiresAt' | 'revokedAt' | 'ip' | 'userAgent' | 'createdAt' | 'updatedAt'
>;

export type AuthContext = {
  token: string | null;
  user: AuthenticatedUser | null;
  session: AuthenticatedSession | null;
  isAuthenticated: boolean;
};

export type SessionContext = {
  ip?: string | null;
  userAgent?: string | null;
};
