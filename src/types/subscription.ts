import type { Plan, Subscription, SubscriptionStatus, User } from '@prisma/client';

export type AccessLevel = 'NONE' | 'TRIAL' | 'PAID';

export type AccessReason =
  | 'NO_SUBSCRIPTION'
  | 'ACTIVE_TRIAL'
  | 'ACTIVE_PAID'
  | 'SUBSCRIPTION_INACTIVE';

export type ResolvedSubscription = Pick<
  Subscription,
  'id' | 'status' | 'startsAt' | 'endsAt' | 'canceledAt' | 'createdAt' | 'updatedAt'
> & {
  plan: Pick<
    Plan,
    'id' | 'code' | 'name' | 'description' | 'durationDays' | 'isTrial' | 'isActive'
  >;
};

export type SubscriptionAccess = {
  userId: string;
  trialUsed: User['trialUsed'];
  hasAccess: boolean;
  level: AccessLevel;
  reason: AccessReason;
  subscription: ResolvedSubscription | null;
};
