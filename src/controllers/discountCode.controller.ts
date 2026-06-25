import type { NextFunction, Request, Response } from 'express';
import { DiscountCodeStatus, DiscountValueType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { requireAuthenticatedUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { discountCodeService } from '../services/discountCode.service';

const isoDateSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const decimalLikeSchema = z.union([z.string().trim().min(1), z.number().finite()]);

const createDiscountCodeBodySchema = z.object({
  code: z.string().trim().min(3).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.nativeEnum(DiscountCodeStatus).optional(),
  valueType: z.nativeEnum(DiscountValueType),
  value: decimalLikeSchema,
  currency: z.string().trim().min(1).max(16).optional().nullable(),
  minimumSubtotalAmount: decimalLikeSchema.optional().nullable(),
  maximumDiscountAmount: decimalLikeSchema.optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  startsAt: isoDateSchema.optional().nullable(),
  endsAt: isoDateSchema.optional().nullable(),
  applicablePlanCodes: z.array(z.string().trim().min(1)).max(25).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const previewDiscountCodeBodySchema = z.object({
  code: z.string().trim().min(1),
  planCode: z.string().trim().min(1)
});

const updateDiscountStatusBodySchema = z.object({
  status: z.nativeEnum(DiscountCodeStatus)
});

const applyDiscountCodeBodySchema = previewDiscountCodeBodySchema;

export const createDiscountCode = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const parsed = createDiscountCodeBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست ایجاد کد تخفیف معتبر نیست.', 400, {
        englishMessage: 'Invalid discount code payload',
        issues: parsed.error.flatten()
      });
    }

    const discountCode = await discountCodeService.createDiscountCode({
      code: parsed.data.code,
      name: parsed.data.name,
      valueType: parsed.data.valueType,
      value: parsed.data.value,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.minimumSubtotalAmount !== undefined
        ? { minimumSubtotalAmount: parsed.data.minimumSubtotalAmount }
        : {}),
      ...(parsed.data.maximumDiscountAmount !== undefined
        ? { maximumDiscountAmount: parsed.data.maximumDiscountAmount }
        : {}),
      ...(parsed.data.maxRedemptions !== undefined
        ? { maxRedemptions: parsed.data.maxRedemptions }
        : {}),
      ...(parsed.data.startsAt !== undefined ? { startsAt: parsed.data.startsAt } : {}),
      ...(parsed.data.endsAt !== undefined ? { endsAt: parsed.data.endsAt } : {}),
      ...(parsed.data.applicablePlanCodes !== undefined
        ? { applicablePlanCodes: parsed.data.applicablePlanCodes }
        : {}),
      ...(parsed.data.metadata !== undefined
        ? { metadata: parsed.data.metadata as Prisma.InputJsonObject }
        : {})
    });

    response.status(201).json({
      status: 'OK',
      discountCode
    });
  } catch (error) {
    next(error);
  }
};

export const updateDiscountCodeStatus = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const parsed = updateDiscountStatusBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست تغییر وضعیت کد تخفیف معتبر نیست.', 400, {
        englishMessage: 'Invalid discount status payload',
        issues: parsed.error.flatten()
      });
    }

    const idParam = request.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      throw new AppError('شناسه کد تخفیف ارسال نشده است.', 400, {
        englishMessage: 'Discount code id is required'
      });
    }

    const discountCode = await discountCodeService.updateStatus(id, parsed.data.status);

    response.json({
      status: 'OK',
      discountCode
    });
  } catch (error) {
    next(error);
  }
};

export const previewDiscountCode = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    requireAuthenticatedUser(request);

    const parsed = previewDiscountCodeBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست بررسی کد تخفیف معتبر نیست.', 400, {
        englishMessage: 'Invalid discount preview payload',
        issues: parsed.error.flatten()
      });
    }

    const preview = await discountCodeService.previewDiscountCode(parsed.data);
    response.json({
      status: 'OK',
      preview
    });
  } catch (error) {
    next(error);
  }
};

export const applyDiscountCode = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const parsed = applyDiscountCodeBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست اعمال کد تخفیف معتبر نیست.', 400, {
        englishMessage: 'Invalid discount apply payload',
        issues: parsed.error.flatten()
      });
    }

    const preview = await discountCodeService.redeemDiscountCode(parsed.data);
    response.json({
      status: 'OK',
      preview
    });
  } catch (error) {
    next(error);
  }
};
