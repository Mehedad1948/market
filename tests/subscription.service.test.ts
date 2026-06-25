import { SubscriptionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findSubscriptionsByUserId: vi.fn(),
  findPlanByCode: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../src/repositories/user.repository', () => ({
  userRepository: {
    findById: repositoryMocks.findUserById
  }
}));

vi.mock('../src/repositories/subscription.repository', () => ({
  subscriptionRepository: {
    findByUserId: repositoryMocks.findSubscriptionsByUserId
  }
}));

vi.mock('../src/repositories/plan.repository', () => ({
  planRepository: {
    findActiveByCode: repositoryMocks.findPlanByCode
  }
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    $transaction: repositoryMocks.transaction
  }
}));

import { subscriptionService } from '../src/services/subscription.service';

const createUser = (overrides: Record<string, unknown> = {}) => ({
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
  updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  ...overrides
});

const createSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'subscription-1',
  userId: 'user-1',
  planId: 'plan-1',
  status: SubscriptionStatus.ACTIVE,
  startsAt: new Date('2026-06-20T00:00:00.000Z'),
  endsAt: new Date('2026-07-20T00:00:00.000Z'),
  canceledAt: null,
  paymentProvider: null,
  paymentReference: null,
  metadata: null,
  createdAt: new Date('2026-06-20T00:00:00.000Z'),
  updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  plan: {
    id: 'plan-1',
    code: 'monthly',
    name: 'Monthly Plan',
    description: '30-day paid subscription.',
    durationDays: 30,
    priceAmount: '4900000',
    currency: 'IRR',
    isTrial: false,
    isActive: true,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z')
  },
  ...overrides
});

describe('subscription.service', () => {
  beforeEach(() => {
    repositoryMocks.findUserById.mockReset();
    repositoryMocks.findSubscriptionsByUserId.mockReset();
    repositoryMocks.findPlanByCode.mockReset();
    repositoryMocks.transaction.mockReset();
  });

  it('returns no access when the user has no subscriptions', async () => {
    repositoryMocks.findUserById.mockResolvedValue(createUser());
    repositoryMocks.findSubscriptionsByUserId.mockResolvedValue([]);

    const access = await subscriptionService.resolveAccessForUser('user-1');

    expect(access).toMatchObject({
      userId: 'user-1',
      trialUsed: false,
      hasAccess: false,
      level: 'NONE',
      reason: 'NO_SUBSCRIPTION',
      subscription: null
    });
  });

  it('returns trial access for an active trial subscription', async () => {
    repositoryMocks.findUserById.mockResolvedValue(createUser({ trialUsed: true }));
    repositoryMocks.findSubscriptionsByUserId.mockResolvedValue([
      createSubscription({
        status: SubscriptionStatus.TRIALING,
        endsAt: new Date('2026-07-09T10:00:00.000Z'),
        plan: {
          id: 'plan-trial',
          code: 'trial-14d',
          name: '14-Day Trial',
          description: 'Trial access for new users.',
          durationDays: 14,
          priceAmount: '0',
          currency: 'IRR',
          isTrial: true,
          isActive: true,
          createdAt: new Date('2026-06-25T10:00:00.000Z'),
          updatedAt: new Date('2026-06-25T10:00:00.000Z')
        }
      })
    ]);

    const access = await subscriptionService.resolveAccessForUser(
      'user-1',
      new Date('2026-06-25T10:00:00.000Z')
    );

    expect(access).toMatchObject({
      hasAccess: true,
      level: 'TRIAL',
      reason: 'ACTIVE_TRIAL',
      trialUsed: true,
      subscription: {
        status: SubscriptionStatus.TRIALING,
        plan: {
          code: 'trial-14d',
          durationDays: 14,
          isTrial: true
        }
      }
    });
  });

  it('prefers paid access when both trial and paid subscriptions are active', async () => {
    repositoryMocks.findUserById.mockResolvedValue(createUser({ trialUsed: true }));
    repositoryMocks.findSubscriptionsByUserId.mockResolvedValue([
      createSubscription({
        id: 'subscription-trial',
        status: SubscriptionStatus.TRIALING,
        endsAt: new Date('2026-07-09T10:00:00.000Z'),
        plan: {
          id: 'plan-trial',
          code: 'trial-14d',
          name: '14-Day Trial',
          description: 'Trial access for new users.',
          durationDays: 14,
          priceAmount: '0',
          currency: 'IRR',
          isTrial: true,
          isActive: true,
          createdAt: new Date('2026-06-25T10:00:00.000Z'),
          updatedAt: new Date('2026-06-25T10:00:00.000Z')
        }
      }),
      createSubscription({
        id: 'subscription-paid',
        status: SubscriptionStatus.ACTIVE,
        endsAt: new Date('2026-07-25T10:00:00.000Z')
      })
    ]);

    const access = await subscriptionService.resolveAccessForUser(
      'user-1',
      new Date('2026-06-25T10:00:00.000Z')
    );

    expect(access).toMatchObject({
      hasAccess: true,
      level: 'PAID',
      reason: 'ACTIVE_PAID',
      subscription: {
        id: 'subscription-paid',
        plan: {
          code: 'monthly',
          isTrial: false
        }
      }
    });
  });

  it('does not treat expired subscriptions as active', async () => {
    repositoryMocks.findUserById.mockResolvedValue(createUser({ trialUsed: true }));
    repositoryMocks.findSubscriptionsByUserId.mockResolvedValue([
      createSubscription({
        status: SubscriptionStatus.ACTIVE,
        endsAt: new Date('2026-06-24T09:59:59.000Z')
      })
    ]);

    const access = await subscriptionService.resolveAccessForUser(
      'user-1',
      new Date('2026-06-25T10:00:00.000Z')
    );

    expect(access).toMatchObject({
      hasAccess: false,
      level: 'NONE',
      reason: 'SUBSCRIPTION_INACTIVE',
      subscription: null
    });
  });

  it('rejects reused trials based on the persisted trialUsed flag', async () => {
    repositoryMocks.findUserById.mockResolvedValue(createUser({ trialUsed: true }));

    await expect(subscriptionService.activateTrial('user-1')).rejects.toMatchObject({
      statusCode: 409,
      payload: {
        englishMessage: 'Trial already used'
      }
    });

    expect(repositoryMocks.findPlanByCode).not.toHaveBeenCalled();
    expect(repositoryMocks.transaction).not.toHaveBeenCalled();
  });

  it('creates a 14-day trial subscription and marks the user as having used the trial', async () => {
    const now = new Date('2026-06-25T10:00:00.000Z');
    const txUserUpdate = vi.fn().mockResolvedValue(null);
    const txSubscriptionCreate = vi.fn().mockResolvedValue(null);

    repositoryMocks.findUserById
      .mockResolvedValueOnce(createUser({ trialUsed: false }))
      .mockResolvedValueOnce(createUser({ trialUsed: false }))
      .mockResolvedValueOnce(createUser({ trialUsed: true }));
    repositoryMocks.findSubscriptionsByUserId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createSubscription({
          id: 'subscription-trial',
          status: SubscriptionStatus.TRIALING,
          startsAt: now,
          endsAt: new Date('2026-07-09T10:00:00.000Z'),
          planId: 'plan-trial',
          plan: {
            id: 'plan-trial',
            code: 'trial-14d',
            name: '14-Day Trial',
            description: 'Trial access for new users.',
            durationDays: 14,
            priceAmount: '0',
            currency: 'IRR',
            isTrial: true,
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        })
      ]);
    repositoryMocks.findPlanByCode.mockResolvedValue({
      id: 'plan-trial',
      code: 'trial-14d',
      name: '14-Day Trial',
      description: 'Trial access for new users.',
      durationDays: 14,
      priceAmount: '0',
      currency: 'IRR',
      isTrial: true,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    repositoryMocks.transaction.mockImplementation(async (callback) => {
      return callback({
        user: {
          update: txUserUpdate
        },
        subscription: {
          create: txSubscriptionCreate
        }
      });
    });

    const access = await subscriptionService.activateTrial('user-1', now);

    expect(repositoryMocks.findPlanByCode).toHaveBeenCalledWith('trial-14d');
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: {
        id: 'user-1'
      },
      data: {
        trialUsed: true
      }
    });
    expect(txSubscriptionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        planId: 'plan-trial',
        status: SubscriptionStatus.TRIALING,
        startsAt: now,
        endsAt: new Date('2026-07-09T10:00:00.000Z')
      }
    });
    expect(access).toMatchObject({
      hasAccess: true,
      level: 'TRIAL',
      reason: 'ACTIVE_TRIAL'
    });
  });
});
