import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { planRepository } from '../repositories/plan.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { userRepository } from '../repositories/user.repository';
import {
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN_CODE
} from './subscription.constants';
import type { ResolvedSubscription, SubscriptionAccess } from '../types/subscription';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE
]);

const addDays = (value: Date, days: number) => {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
};

const isSubscriptionCurrentlyActive = (
  subscription: {
    status: SubscriptionStatus;
    startsAt: Date;
    endsAt: Date;
    plan: {
      isActive: boolean;
      isTrial: boolean;
    };
  },
  now: Date
) => {
  return (
    subscription.plan.isActive &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) &&
    subscription.startsAt <= now &&
    subscription.endsAt > now
  );
};

const compareSubscriptions = (
  left: {
    endsAt: Date;
    startsAt: Date;
    plan: { isTrial: boolean };
  },
  right: {
    endsAt: Date;
    startsAt: Date;
    plan: { isTrial: boolean };
  }
) => {
  if (left.plan.isTrial !== right.plan.isTrial) {
    return Number(left.plan.isTrial) - Number(right.plan.isTrial);
  }

  const endsAtDiff = right.endsAt.getTime() - left.endsAt.getTime();
  if (endsAtDiff !== 0) {
    return endsAtDiff;
  }

  return right.startsAt.getTime() - left.startsAt.getTime();
};

const toResolvedSubscription = (
  subscription: Awaited<ReturnType<typeof subscriptionRepository.findByUserId>>[number]
): ResolvedSubscription => {
  return {
    id: subscription.id,
    status: subscription.status,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    canceledAt: subscription.canceledAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      description: subscription.plan.description,
      durationDays: subscription.plan.durationDays,
      isTrial: subscription.plan.isTrial,
      isActive: subscription.plan.isActive
    }
  };
};

export const subscriptionService = {
  async resolveAccessForUser(userId: string, now = new Date()): Promise<SubscriptionAccess> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError('کاربر یافت نشد.', 404, {
        englishMessage: 'User not found'
      });
    }

    const subscriptions = await subscriptionRepository.findByUserId(userId);
    const activeSubscription = subscriptions
      .filter((subscription) => isSubscriptionCurrentlyActive(subscription, now))
      .sort(compareSubscriptions)[0];

    if (!activeSubscription) {
      return {
        userId,
        trialUsed: user.trialUsed,
        hasAccess: false,
        level: 'NONE',
        reason: subscriptions.length > 0 ? 'SUBSCRIPTION_INACTIVE' : 'NO_SUBSCRIPTION',
        subscription: null
      };
    }

    return {
      userId,
      trialUsed: user.trialUsed,
      hasAccess: true,
      level: activeSubscription.plan.isTrial ? 'TRIAL' : 'PAID',
      reason: activeSubscription.plan.isTrial ? 'ACTIVE_TRIAL' : 'ACTIVE_PAID',
      subscription: toResolvedSubscription(activeSubscription)
    };
  },

  async activateTrial(userId: string, now = new Date()) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError('کاربر یافت نشد.', 404, {
        englishMessage: 'User not found'
      });
    }

    if (user.trialUsed) {
      throw new AppError('دوره آزمایشی قبلا فعال شده است.', 409, {
        englishMessage: 'Trial already used'
      });
    }

    const currentAccess = await this.resolveAccessForUser(userId, now);
    if (currentAccess.hasAccess) {
      throw new AppError('اشتراک فعال برای کاربر وجود دارد.', 409, {
        englishMessage: 'Active subscription already exists'
      });
    }

    const plan = await planRepository.findActiveByCode(TRIAL_PLAN_CODE);
    if (!plan || !plan.isTrial || plan.durationDays !== TRIAL_DURATION_DAYS) {
      throw new AppError('پلن آزمایشی پیکربندی معتبری ندارد.', 500, {
        englishMessage: 'Trial plan is misconfigured'
      });
    }

    const startsAt = now;
    const endsAt = addDays(startsAt, TRIAL_DURATION_DAYS);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId
        },
        data: {
          trialUsed: true
        }
      });

      await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          startsAt,
          endsAt
        }
      });
    });

    return this.resolveAccessForUser(userId, now);
  }
};
