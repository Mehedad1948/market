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

export type PortfolioMetrics = {
  holdingsCount: number;
  pricedHoldingsCount: number;
  unpricedHoldingsCount: number;
  totalCostBasis: number | null;
  totalMarketValue: number | null;
  totalUnrealizedProfitLoss: number | null;
  totalUnrealizedProfitLossPercent: number | null;
  topHoldingWeight: number | null;
  top3Weight: number | null;
  concentrationHhi: number | null;
};

export type PortfolioHolding = {
  id: string;
  symbol: string;
  quantity: number;
  averageBuyPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestDataDate: string | null;
  currentPrice: number | null;
  latestClosePriceChangePercent: number | null;
  metrics: {
    costBasis: number | null;
    marketValue: number | null;
    unrealizedProfitLoss: number | null;
    unrealizedProfitLossPercent: number | null;
  };
  actionGuidance:
    | {
        compositeAction: string;
        bias: string;
        score: number;
        entryTiming: string;
        recommendedAction: string;
        existingPositionAdvice: {
          shortTerm: string;
          midTerm: string;
          longTerm: string;
        };
        persianSummary: string;
        analyzedAt: string;
      }
    | null;
  concentrationWeight: number | null;
};

export type Portfolio = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  metrics: PortfolioMetrics;
  holdings: PortfolioHolding[];
};

export type PortfolioResponse = {
  status: 'OK';
  portfolio: Portfolio;
};

export type DeletePortfolioResponse = {
  status: 'OK';
  removed: {
    id: string;
    name: string;
  };
};

export type RenamePortfolioRequest = {
  name: string;
};

export type CreatePortfolioHoldingRequest = {
  symbol: string;
  quantity: number;
  averageBuyPrice?: number | null;
  notes?: string | null;
};

export type UpdatePortfolioHoldingRequest = {
  quantity: number;
  averageBuyPrice?: number | null;
  notes?: string | null;
};

export type PortfolioIdParams = {
  portfolioId: string;
};

export type PortfolioHoldingParams = {
  portfolioId: string;
  symbol: string;
};
