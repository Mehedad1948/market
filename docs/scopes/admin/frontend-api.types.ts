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

export type DiscountValueType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type CreateDiscountCodeRequest = {
  code: string;
  name: string;
  description?: string | null;
  status?: DiscountCodeStatus;
  valueType: DiscountValueType;
  value: string | number;
  currency?: string | null;
  minimumSubtotalAmount?: string | number | null;
  maximumDiscountAmount?: string | number | null;
  maxRedemptions?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  applicablePlanCodes?: string[];
  metadata?: Record<string, JsonValue>;
};

export type DiscountCodeCheckoutRequest = {
  code: string;
  planCode: string;
};

export type DiscountCode = {
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
  startsAt: string | null;
  endsAt: string | null;
  applicablePlanCodes: string[];
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
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

export type DiscountCodeResponse = {
  status: 'OK';
  discountCode: DiscountCode;
};

export type DiscountPreviewResponse = {
  status: 'OK';
  preview: DiscountPreview;
};

export type DiscountCodeIdParams = {
  id: string;
};

export type UpdateDiscountCodeStatusRequest = {
  status: DiscountCodeStatus;
};
