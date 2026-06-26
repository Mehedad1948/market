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

export type SymbolPathParams = {
  symbol: string;
};

export type WatchlistItem = {
  id: string;
  symbol: string;
  createdAt: string;
};

export type AddWatchlistSymbolRequest = {
  symbol: string;
};

export type ListWatchlistResponse = {
  status: 'OK';
  items: WatchlistItem[];
};

export type AddWatchlistSymbolResponse = {
  status: 'OK';
  item: WatchlistItem;
};

export type RemoveWatchlistSymbolResponse = {
  status: 'OK';
  removed: {
    symbol: string;
  };
};
