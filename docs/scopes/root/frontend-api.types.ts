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

export type RootHtmlResponse = string;

export type HealthResponse = {
  status: 'ok - 1';
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

export type StockAnalysisQuery = {
  weeklyWindow?: number;
  monthlyWindow?: number;
  quarterlyWindow?: number;
  forceRefresh?: boolean;
  includeRealLegal?: boolean;
};

export type StockAnalysisResult = {
  status: 'OK' | 'INSUFFICIENT_DATA';
  symbol?: string;
  source?: 'database' | 'brsapi' | 'mixed';
  cacheHit?: boolean;
  latestDataDate?: string;
  windows?: {
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  metrics?: Record<string, JsonValue>;
  analysisProfile?: {
    indicatorMode: string;
    disabledIndicators: string[];
    enabledIndicators: string[];
  };
  signals?: Record<string, JsonValue>;
  persianSummary?: string;
  disclaimer?: string;
};

export type StockAnalysisResponse = StockAnalysisResult;

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

export type ListPortfoliosResponse = {
  status: 'OK';
  portfolios: Portfolio[];
};

export type PortfolioResponse = {
  status: 'OK';
  portfolio: Portfolio;
};

export type CreatePortfolioRequest = {
  name?: string;
};
