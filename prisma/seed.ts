import { PrismaClient } from '@prisma/client';

import {
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN_CODE
} from '../src/services/subscription.constants';

const prisma = new PrismaClient();

const plans = [
  {
    code: TRIAL_PLAN_CODE,
    name: '14-Day Trial',
    description: 'Trial access for new users.',
    durationDays: TRIAL_DURATION_DAYS,
    priceAmount: '0',
    currency: 'IRR',
    isTrial: true,
    isActive: true
  },
  {
    code: 'monthly',
    name: 'Monthly Plan',
    description: '30-day paid subscription.',
    durationDays: 30,
    priceAmount: '4900000',
    currency: 'IRR',
    isTrial: false,
    isActive: true
  },
  {
    code: 'quarterly',
    name: 'Quarterly Plan',
    description: '90-day paid subscription.',
    durationDays: 90,
    priceAmount: '12900000',
    currency: 'IRR',
    isTrial: false,
    isActive: true
  },
  {
    code: 'semiannual',
    name: 'Semiannual Plan',
    description: '180-day paid subscription.',
    durationDays: 180,
    priceAmount: '23900000',
    currency: 'IRR',
    isTrial: false,
    isActive: true
  },
  {
    code: 'annual',
    name: 'Annual Plan',
    description: '365-day paid subscription.',
    durationDays: 365,
    priceAmount: '44900000',
    currency: 'IRR',
    isTrial: false,
    isActive: true
  }
] as const;

const seedPlans = async () => {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        code: plan.code
      },
      update: {
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        isTrial: plan.isTrial,
        isActive: plan.isActive
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        isTrial: plan.isTrial,
        isActive: plan.isActive
      }
    });
  }
};

const main = async () => {
  await seedPlans();
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to seed plans', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
