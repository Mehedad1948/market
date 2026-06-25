import { DiscountCodeStatus, DiscountValueType, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  findPlanByCode: vi.fn(),
  findPlansByCodes: vi.fn(),
  createDiscountCode: vi.fn(),
  findDiscountCodeById: vi.fn(),
  findDiscountCodeByCode: vi.fn(),
  updateDiscountCodeStatus: vi.fn(),
  incrementRedemptionCountIfAvailable: vi.fn()
}));

vi.mock('../src/repositories/plan.repository', () => ({
  planRepository: {
    findByCode: repositoryMocks.findPlanByCode,
    findByCodes: repositoryMocks.findPlansByCodes
  }
}));

vi.mock('../src/repositories/discountCode.repository', () => ({
  discountCodeRepository: {
    create: repositoryMocks.createDiscountCode,
    findById: repositoryMocks.findDiscountCodeById,
    findByCode: repositoryMocks.findDiscountCodeByCode,
    updateStatus: repositoryMocks.updateDiscountCodeStatus,
    incrementRedemptionCountIfAvailable: repositoryMocks.incrementRedemptionCountIfAvailable
  }
}));

import { discountCodeService } from '../src/services/discountCode.service';

const createPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-monthly',
  code: 'monthly',
  name: 'Monthly Plan',
  description: '30-day paid subscription.',
  durationDays: 30,
  priceAmount: '4900000',
  currency: 'IRR',
  isTrial: false,
  isActive: true,
  createdAt: new Date('2026-06-25T00:00:00.000Z'),
  updatedAt: new Date('2026-06-25T00:00:00.000Z'),
  ...overrides
});

const createDiscountCode = (overrides: Record<string, unknown> = {}) => ({
  id: 'discount-1',
  code: 'SUMMER25',
  name: 'Summer 25',
  description: 'Seasonal offer',
  status: DiscountCodeStatus.ACTIVE,
  valueType: DiscountValueType.PERCENTAGE,
  value: new Prisma.Decimal(25),
  currency: null,
  minimumSubtotalAmount: null,
  maximumDiscountAmount: null,
  maxRedemptions: 5,
  redemptionCount: 0,
  startsAt: new Date('2026-06-01T00:00:00.000Z'),
  endsAt: new Date('2026-07-01T00:00:00.000Z'),
  metadata: null,
  createdByUserId: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  applicablePlans: [
    {
      plan: createPlan()
    }
  ],
  ...overrides
});

describe('discountCode.service', () => {
  beforeEach(() => {
    repositoryMocks.findPlanByCode.mockReset();
    repositoryMocks.findPlansByCodes.mockReset();
    repositoryMocks.createDiscountCode.mockReset();
    repositoryMocks.findDiscountCodeById.mockReset();
    repositoryMocks.findDiscountCodeByCode.mockReset();
    repositoryMocks.updateDiscountCodeStatus.mockReset();
    repositoryMocks.incrementRedemptionCountIfAvailable.mockReset();
  });

  it('creates a bounded percentage discount code for compatible plans', async () => {
    repositoryMocks.findPlansByCodes.mockResolvedValue([createPlan()]);
    repositoryMocks.createDiscountCode.mockResolvedValue(createDiscountCode());

    const result = await discountCodeService.createDiscountCode({
      code: 'summer25',
      name: 'Summer 25',
      valueType: DiscountValueType.PERCENTAGE,
      value: '25',
      maxRedemptions: 5,
      applicablePlanCodes: ['monthly']
    });

    expect(repositoryMocks.createDiscountCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SUMMER25',
        valueType: DiscountValueType.PERCENTAGE
      }),
      ['plan-monthly']
    );
    expect(result).toMatchObject({
      code: 'SUMMER25',
      valueType: DiscountValueType.PERCENTAGE,
      maxRedemptions: 5,
      applicablePlanCodes: ['monthly']
    });
  });

  it('calculates a valid preview without mutating the plan price', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan());
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(createDiscountCode());

    const preview = await discountCodeService.previewDiscountCode({
      code: 'summer25',
      planCode: 'monthly',
      now: new Date('2026-06-25T10:00:00.000Z')
    });

    expect(preview).toMatchObject({
      valid: true,
      status: 'VALID',
      originalAmount: '4900000.00',
      discountAmount: '1225000.00',
      finalAmount: '3675000.00',
      planCode: 'monthly',
      code: 'SUMMER25'
    });
  });

  it('marks expired discount codes as invalid', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan());
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(
      createDiscountCode({
        endsAt: new Date('2026-06-24T23:59:59.000Z')
      })
    );

    const preview = await discountCodeService.previewDiscountCode({
      code: 'summer25',
      planCode: 'monthly',
      now: new Date('2026-06-25T10:00:00.000Z')
    });

    expect(preview).toMatchObject({
      valid: false,
      status: 'EXPIRED',
      finalAmount: '4900000.00'
    });
  });

  it('marks disabled discount codes as invalid', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan());
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(
      createDiscountCode({
        status: DiscountCodeStatus.DISABLED
      })
    );

    const preview = await discountCodeService.previewDiscountCode({
      code: 'summer25',
      planCode: 'monthly',
      now: new Date('2026-06-25T10:00:00.000Z')
    });

    expect(preview).toMatchObject({
      valid: false,
      status: 'DISABLED'
    });
  });

  it('marks exhausted discount codes as invalid', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan());
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(
      createDiscountCode({
        maxRedemptions: 1,
        redemptionCount: 1
      })
    );

    const preview = await discountCodeService.previewDiscountCode({
      code: 'summer25',
      planCode: 'monthly',
      now: new Date('2026-06-25T10:00:00.000Z')
    });

    expect(preview).toMatchObject({
      valid: false,
      status: 'EXHAUSTED'
    });
  });

  it('marks incompatible-plan discount codes as invalid', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan({ code: 'annual', id: 'plan-annual' }));
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(createDiscountCode());

    const preview = await discountCodeService.previewDiscountCode({
      code: 'summer25',
      planCode: 'annual',
      now: new Date('2026-06-25T10:00:00.000Z')
    });

    expect(preview).toMatchObject({
      valid: false,
      status: 'INCOMPATIBLE_PLAN',
      planCode: 'annual'
    });
  });

  it('fails redemption when a concurrent request exhausts the code first', async () => {
    repositoryMocks.findPlanByCode.mockResolvedValue(createPlan());
    repositoryMocks.findDiscountCodeByCode.mockResolvedValue(createDiscountCode());
    repositoryMocks.incrementRedemptionCountIfAvailable.mockResolvedValue(0);

    await expect(
      discountCodeService.redeemDiscountCode({
        code: 'summer25',
        planCode: 'monthly',
        now: new Date('2026-06-25T10:00:00.000Z')
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      payload: {
        englishMessage: 'Discount code is no longer available'
      }
    });
  });
});
