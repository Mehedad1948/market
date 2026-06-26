/* Generated frontend-facing API contract types.
   This file is intentionally standalone so you can copy it into another project.
   Dates are ISO strings in the frontend contract, even when the backend uses Date objects internally. */

export type ErrorResponse = {
  status: 'ERROR';
  message: string;
  englishMessage?: string;
  issues?: unknown;
  preview?: DiscountPreview;
  limit?: number;
  accessLevel?: string;
  [key: string]: unknown;
};

export type AuthenticatedUser = {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  isActive: boolean;
  trialUsed: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedSession = {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurrentAuthResponse = {
  status: 'OK';
  authenticated: boolean;
  user: AuthenticatedUser | null;
  session:
    | {
        id: string;
        expiresAt: string;
        createdAt: string;
      }
    | null;
};

export type BaleCallbackRequest = {
  baleUser: {
    id: string | number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  };
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
};

export type EmailOtpRequest = {
  email: string;
};

export type EmailOtpRequestResponse = {
  status: 'OK';
  channel: 'EMAIL';
  email: string;
  expiresAt: string;
  retryAfterSeconds: number;
};

export type EmailOtpVerifyRequest = {
  email: string;
  code: string;
  displayName?: string | null;
};

export type FederatedAuthResponse = {
  status: 'OK';
  provider: 'BALE' | 'EMAIL' | 'TELEGRAM' | 'GOOGLE';
  authenticated: true;
  token: string;
  user: AuthenticatedUser;
  session: AuthenticatedSession | null;
  authAccount: {
    id: string;
    provider: string;
    providerAccountId: string;
  };
  isNewUser: boolean;
  linkedAccount: boolean;
  isNewAuthAccount: boolean;
};

export type TelegramCallbackRequest = {
  id: string | number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  auth_date: string | number;
  hash: string;
};

export type GoogleCallbackRequest = {
  idToken: string;
  nonce?: string | null;
};

export type LogoutResponse = {
  status: 'OK';
  loggedOut: true;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationDays: number;
  isTrial: boolean;
  isActive: boolean;
};

export type ResolvedSubscription = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
};

export type SubscriptionAccess = {
  userId: string;
  trialUsed: boolean;
  hasAccess: boolean;
  level: 'NONE' | 'TRIAL' | 'PAID';
  reason:
    | 'NO_SUBSCRIPTION'
    | 'ACTIVE_TRIAL'
    | 'ACTIVE_PAID'
    | 'SUBSCRIPTION_INACTIVE';
  subscription: ResolvedSubscription | null;
};

export type SubscriptionAccessResponse = {
  status: 'OK';
  access: SubscriptionAccess;
};

export type DiscountPreview = {
  valid: boolean;
  status:
    | 'VALID'
    | 'NOT_FOUND'
    | 'DISABLED'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'EXHAUSTED'
    | 'INCOMPATIBLE_PLAN'
    | 'MINIMUM_SUBTOTAL_NOT_MET';
  planCode: string;
  originalAmount: string;
  discountAmount: string;
  finalAmount: string;
  currency: string | null;
  code: string | null;
  paymentSnapshot: {
    amountBeforeDiscount: string;
    discountAmount: string;
    finalAmount: string;
    discountCodeSnapshot: string | null;
  };
};
