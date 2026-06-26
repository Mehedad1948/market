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

export type AlertRuleType = 'SIGNAL_ACTION' | 'SIGNAL_SCORE' | 'WATCHLIST_CHANGE';
export type AlertRuleScope = 'ALL_WATCHLIST' | 'SYMBOL';
export type WatchlistChangeEvent = 'ADDED' | 'REMOVED';

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  scope: AlertRuleScope;
  symbol: string | null;
  signalAction: string | null;
  minScore: number | null;
  watchlistChangeEvent: WatchlistChangeEvent | null;
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAlertRuleRequest = {
  type: AlertRuleType;
  scope?: AlertRuleScope;
  symbol?: string | null;
  signalAction?: string | null;
  minScore?: number | null;
  watchlistChangeEvent?: WatchlistChangeEvent | null;
  enabled?: boolean;
  cooldownMinutes?: number;
};

export type AlertRuleIdParams = {
  id: string;
};

export type ListAlertRulesResponse = {
  status: 'OK';
  rules: AlertRule[];
};

export type CreateAlertRuleResponse = {
  status: 'OK';
  rule: AlertRule;
};

export type DeleteAlertRuleResponse = {
  status: 'OK';
  removed: {
    id: string;
  };
};
