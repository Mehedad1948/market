import {
  DiscountCodeStatus,
  DiscountValueType,
  Prisma,
  type DiscountCode,
  type Plan
} from '@prisma/client';

import { AppError } from '../middleware/errorHandler';
import { discountCodeRepository } from '../repositories/discountCode.repository';
import { planRepository } from '../repositories/plan.repository';

type DiscountCodeWithPlans = Awaited<ReturnType<typeof discountCodeRepository.findByCode>>;

type SerializedDiscountCode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: DiscountCodeStatus;
  valueType: DiscountValueType;
  value: string;
  currency: string | null;
  minimumSubtotalAmount: string | null;
  maximumDiscountAmount: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  applicablePlanCodes: string[];
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DiscountPreviewStatus =
  | 'VALID'
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'INCOMPATIBLE_PLAN'
  | 'MINIMUM_SUBTOTAL_NOT_MET';

type DiscountPreview = {
  valid: boolean;
  status: DiscountPreviewStatus;
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

type CreateDiscountCodeInput = {
  code: string;
  name: string;
  description?: string | null | undefined;
  status?: DiscountCodeStatus | undefined;
  valueType: DiscountValueType;
  value: string | number;
  currency?: string | null | undefined;
  minimumSubtotalAmount?: string | number | null | undefined;
  maximumDiscountAmount?: string | number | null | undefined;
  maxRedemptions?: number | null | undefined;
  startsAt?: Date | null | undefined;
  endsAt?: Date | null | undefined;
  applicablePlanCodes?: string[] | undefined;
  createdByUserId?: string | null | undefined;
  metadata?: Prisma.InputJsonObject | undefined;
};

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

const normalizeCode = (code: string) => code.trim().toUpperCase();

const toDecimal = (value: Prisma.Decimal | string | number) => {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
};

const serializeDecimal = (value: Prisma.Decimal | null) => {
  return value ? value.toFixed(2) : null;
};

const serializeDiscountCode = (discountCode: NonNullable<DiscountCodeWithPlans>): SerializedDiscountCode => {
  return {
    id: discountCode.id,
    code: discountCode.code,
    name: discountCode.name,
    description: discountCode.description,
    status: discountCode.status,
    valueType: discountCode.valueType,
    value: discountCode.value.toFixed(2),
    currency: discountCode.currency,
    minimumSubtotalAmount: serializeDecimal(discountCode.minimumSubtotalAmount),
    maximumDiscountAmount: serializeDecimal(discountCode.maximumDiscountAmount),
    maxRedemptions: discountCode.maxRedemptions,
    redemptionCount: discountCode.redemptionCount,
    startsAt: discountCode.startsAt,
    endsAt: discountCode.endsAt,
    applicablePlanCodes: discountCode.applicablePlans.map(({ plan }) => plan.code),
    createdByUserId: discountCode.createdByUserId,
    createdAt: discountCode.createdAt,
    updatedAt: discountCode.updatedAt
  };
};

const assertManagedRuleSet = (input: CreateDiscountCodeInput) => {
  const value = toDecimal(input.value);
  if (value.lte(ZERO)) {
    throw new AppError('مقدار تخفیف باید بیشتر از صفر باشد.', 400, {
      englishMessage: 'Discount value must be greater than zero'
    });
  }

  if (input.valueType === DiscountValueType.PERCENTAGE && value.gt(ONE_HUNDRED)) {
    throw new AppError('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.', 400, {
      englishMessage: 'Percentage discount cannot exceed 100'
    });
  }

  if (input.valueType === DiscountValueType.FIXED_AMOUNT) {
    const currency = input.currency?.trim() ?? '';
    if (currency.length === 0) {
      throw new AppError('برای تخفیف مبلغ ثابت، واحد پول الزامی است.', 400, {
        englishMessage: 'Fixed amount discounts require a currency'
      });
    }
  }

  if (input.valueType === DiscountValueType.PERCENTAGE && input.currency) {
    throw new AppError('برای تخفیف درصدی، واحد پول نباید ارسال شود.', 400, {
      englishMessage: 'Percentage discounts must not define a currency'
    });
  }

  if (input.maxRedemptions !== undefined && input.maxRedemptions !== null && input.maxRedemptions <= 0) {
    throw new AppError('سقف استفاده باید بیشتر از صفر باشد.', 400, {
      englishMessage: 'Usage limit must be greater than zero'
    });
  }

  const minimumSubtotalAmount =
    input.minimumSubtotalAmount === undefined || input.minimumSubtotalAmount === null
      ? null
      : toDecimal(input.minimumSubtotalAmount);
  if (minimumSubtotalAmount && minimumSubtotalAmount.lt(ZERO)) {
    throw new AppError('حداقل مبلغ سفارش نمی‌تواند منفی باشد.', 400, {
      englishMessage: 'Minimum subtotal cannot be negative'
    });
  }

  const maximumDiscountAmount =
    input.maximumDiscountAmount === undefined || input.maximumDiscountAmount === null
      ? null
      : toDecimal(input.maximumDiscountAmount);
  if (maximumDiscountAmount && maximumDiscountAmount.lte(ZERO)) {
    throw new AppError('سقف مبلغ تخفیف باید بیشتر از صفر باشد.', 400, {
      englishMessage: 'Maximum discount amount must be greater than zero'
    });
  }

  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    throw new AppError('بازه زمانی کد تخفیف معتبر نیست.', 400, {
      englishMessage: 'Discount validity window is invalid'
    });
  }
};

const assertPlanCompatibility = (plan: Plan, discountCode: NonNullable<DiscountCodeWithPlans>) => {
  if (discountCode.applicablePlans.length === 0) {
    return;
  }

  const isCompatible = discountCode.applicablePlans.some(({ plan: applicablePlan }) => {
    return applicablePlan.id === plan.id && applicablePlan.isActive;
  });

  if (!isCompatible) {
    throw new AppError('این کد تخفیف برای پلن انتخاب‌شده قابل استفاده نیست.', 409, {
      englishMessage: 'Discount code is not compatible with the selected plan'
    });
  }
};

const buildPreview = (
  plan: Plan,
  discountCode: DiscountCodeWithPlans,
  now: Date
): DiscountPreview => {
  const originalAmountDecimal = toDecimal(plan.priceAmount ?? ZERO);
  const originalAmount = originalAmountDecimal.toFixed(2);
  const emptyPreview = (status: DiscountPreviewStatus, code: string | null): DiscountPreview => ({
    valid: false,
    status,
    planCode: plan.code,
    originalAmount,
    discountAmount: ZERO.toFixed(2),
    finalAmount: originalAmount,
    currency: plan.currency,
    code,
    paymentSnapshot: {
      amountBeforeDiscount: originalAmount,
      discountAmount: ZERO.toFixed(2),
      finalAmount: originalAmount,
      discountCodeSnapshot: null
    }
  });

  if (!discountCode) {
    return emptyPreview('NOT_FOUND', null);
  }

  if (discountCode.status !== DiscountCodeStatus.ACTIVE) {
    return emptyPreview('DISABLED', discountCode.code);
  }

  if (discountCode.startsAt && discountCode.startsAt > now) {
    return emptyPreview('NOT_STARTED', discountCode.code);
  }

  if (discountCode.endsAt && discountCode.endsAt <= now) {
    return emptyPreview('EXPIRED', discountCode.code);
  }

  if (
    discountCode.maxRedemptions !== null &&
    discountCode.maxRedemptions !== undefined &&
    discountCode.redemptionCount >= discountCode.maxRedemptions
  ) {
    return emptyPreview('EXHAUSTED', discountCode.code);
  }

  const isCompatible =
    discountCode.applicablePlans.length === 0 ||
    discountCode.applicablePlans.some(({ plan: applicablePlan }) => {
      return applicablePlan.id === plan.id && applicablePlan.isActive;
    });
  if (!isCompatible) {
    return emptyPreview('INCOMPATIBLE_PLAN', discountCode.code);
  }

  if (
    discountCode.minimumSubtotalAmount &&
    originalAmountDecimal.lt(discountCode.minimumSubtotalAmount)
  ) {
    return emptyPreview('MINIMUM_SUBTOTAL_NOT_MET', discountCode.code);
  }

  let discountAmount = ZERO;
  if (discountCode.valueType === DiscountValueType.PERCENTAGE) {
    discountAmount = originalAmountDecimal.mul(discountCode.value).div(ONE_HUNDRED);
  } else {
    discountAmount = discountCode.value;
  }

  if (discountCode.maximumDiscountAmount && discountAmount.gt(discountCode.maximumDiscountAmount)) {
    discountAmount = discountCode.maximumDiscountAmount;
  }

  if (discountAmount.gt(originalAmountDecimal)) {
    discountAmount = originalAmountDecimal;
  }

  const finalAmount = originalAmountDecimal.sub(discountAmount);
  const codeSnapshot = JSON.stringify({
    code: discountCode.code,
    valueType: discountCode.valueType,
    value: discountCode.value.toFixed(2)
  });

  return {
    valid: true,
    status: 'VALID',
    planCode: plan.code,
    originalAmount,
    discountAmount: discountAmount.toFixed(2),
    finalAmount: finalAmount.toFixed(2),
    currency: plan.currency,
    code: discountCode.code,
    paymentSnapshot: {
      amountBeforeDiscount: originalAmount,
      discountAmount: discountAmount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
      discountCodeSnapshot: codeSnapshot
    }
  };
};

const getPlanForCheckout = async (planCode: string) => {
  const normalizedPlanCode = planCode.trim().toLowerCase();
  const plan = await planRepository.findByCode(normalizedPlanCode);

  if (!plan || !plan.isActive) {
    throw new AppError('پلن انتخاب‌شده معتبر نیست.', 404, {
      englishMessage: 'Plan not found'
    });
  }

  if (!plan.priceAmount) {
    throw new AppError('قیمت پلن انتخاب‌شده پیکربندی نشده است.', 500, {
      englishMessage: 'Plan price is not configured'
    });
  }

  return plan;
};

export const discountCodeService = {
  async createDiscountCode(input: CreateDiscountCodeInput) {
    assertManagedRuleSet(input);

    const code = normalizeCode(input.code);
    const applicablePlanCodes = [...new Set((input.applicablePlanCodes ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))];
    const applicablePlans =
      applicablePlanCodes.length > 0 ? await planRepository.findByCodes(applicablePlanCodes) : [];

    if (applicablePlans.length !== applicablePlanCodes.length) {
      throw new AppError('حداقل یکی از پلن‌های قابل‌اعمال یافت نشد.', 400, {
        englishMessage: 'One or more applicable plans were not found'
      });
    }

    const createData: Prisma.DiscountCodeCreateInput = {
      code,
      name: input.name.trim(),
      status: input.status ?? DiscountCodeStatus.ACTIVE,
      valueType: input.valueType,
      value: toDecimal(input.value),
      ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
      ...(input.valueType === DiscountValueType.FIXED_AMOUNT
        ? { currency: input.currency?.trim() ?? null }
        : {}),
      ...(input.minimumSubtotalAmount === undefined
        ? {}
        : {
            minimumSubtotalAmount:
              input.minimumSubtotalAmount === null ? null : toDecimal(input.minimumSubtotalAmount)
          }),
      ...(input.maximumDiscountAmount === undefined
        ? {}
        : {
            maximumDiscountAmount:
              input.maximumDiscountAmount === null ? null : toDecimal(input.maximumDiscountAmount)
          }),
      ...(input.maxRedemptions !== undefined ? { maxRedemptions: input.maxRedemptions } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.createdByUserId
        ? {
            createdByUser: {
              connect: {
                id: input.createdByUserId
              }
            }
          }
        : {})
    };

    const created = await discountCodeRepository.create(createData, applicablePlans.map((plan) => plan.id));

    return serializeDiscountCode(created);
  },

  async updateStatus(id: string, status: DiscountCodeStatus) {
    const existing = await discountCodeRepository.findById(id);
    if (!existing) {
      throw new AppError('کد تخفیف یافت نشد.', 404, {
        englishMessage: 'Discount code not found'
      });
    }

    const updated = await discountCodeRepository.updateStatus(id, status);
    return serializeDiscountCode(updated);
  },

  async previewDiscountCode(input: { code: string; planCode: string; now?: Date }) {
    const plan = await getPlanForCheckout(input.planCode);
    const normalizedCode = normalizeCode(input.code);
    const discountCode = await discountCodeRepository.findByCode(normalizedCode);
    return buildPreview(plan, discountCode, input.now ?? new Date());
  },

  async redeemDiscountCode(input: { code: string; planCode: string; now?: Date }) {
    const now = input.now ?? new Date();
    const plan = await getPlanForCheckout(input.planCode);
    const normalizedCode = normalizeCode(input.code);
    const discountCode = await discountCodeRepository.findByCode(normalizedCode);
    const preview = buildPreview(plan, discountCode, now);

    if (!preview.valid || !discountCode) {
      throw new AppError('کد تخفیف در زمان اعمال معتبر نیست.', 409, {
        englishMessage: 'Discount code is not valid for redemption',
        preview
      });
    }

    assertPlanCompatibility(plan, discountCode);

    const updatedCount = await discountCodeRepository.incrementRedemptionCountIfAvailable(
      discountCode.id,
      now
    );

    if (updatedCount < 1) {
      throw new AppError('ظرفیت این کد تخفیف به پایان رسیده است.', 409, {
        englishMessage: 'Discount code is no longer available'
      });
    }

    return preview;
  }
};
