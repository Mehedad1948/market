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

export type InstrumentType = 'STOCK' | 'ETF' | 'RIGHT' | 'BOND' | 'UNKNOWN';

export type GroupedSymbolsQuery = {
  grouping?: 'macro' | 'official';
  hideDuplicateBoards?: boolean;
  includeInactive?: boolean;
  includeTypes?: string;
  search?: string;
  format?: 'array' | 'object';
};

export type CatalogSymbolItem = {
  code: string;
  label: string;
  isin: string | null;
  sectorId: string | null;
  sectorName: string | null;
  displaySector: string | null;
  instrumentType: InstrumentType;
  marketGroupKey?: string;
  marketGroupLabel?: string;
  marketGroupIcon?: string;
  baseCode?: string;
  isDuplicateBoard?: boolean;
};

export type CatalogChildGroup = {
  key: string;
  sectorId: string | null;
  label: string;
  displayLabel: string;
  symbolCount: number;
  symbols: CatalogSymbolItem[];
};

export type CatalogGroup = {
  key: string;
  label: string;
  symbolCount: number;
  icon?: string;
  sortOrder?: number;
  children?: CatalogChildGroup[];
  symbols?: CatalogSymbolItem[];
};

export type SymbolImportResponse = {
  status: 'OK';
  source: string;
  importedAt: string;
  summary: Record<string, number>;
};

export type GroupedSymbolsResponse = {
  status: 'OK';
  grouping: 'macro' | 'official';
  updatedAt: string | null;
  groups: CatalogGroup[] | Record<string, CatalogGroup>;
};

export type SearchSymbolsQuery = {
  q: string;
};

export type SearchSymbolsResponse = {
  status: 'OK';
  query: string;
  results: CatalogSymbolItem[];
};
