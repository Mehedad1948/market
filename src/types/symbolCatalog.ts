export type InstrumentType = 'STOCK' | 'ETF' | 'RIGHT' | 'BOND' | 'UNKNOWN';

export type BrsAllSymbolItem = {
  l18?: string;
  l30?: string;
  isin?: string;
  id?: string | number;
  cs?: string;
  cs_id?: string | number;
  [key: string]: unknown;
};

export type NormalizedCatalogSymbol = {
  symbol: string;
  name: string;
  isin: string | null;
  tsetmcId: string | null;
  sectorId: string | null;
  sectorName: string | null;
  displaySector: string | null;
  instrumentType: InstrumentType;
  isActive: boolean;
  rawJson: BrsAllSymbolItem;
  lastSeenAt: Date;
};

export type CatalogSymbolItem = {
  code: string;
  label: string;
  isin: string | null;
  sectorId: string | null;
  sectorName: string | null;
  displaySector: string | null;
  instrumentType: InstrumentType;
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
  children?: CatalogChildGroup[];
  symbols?: CatalogSymbolItem[];
};

export type GroupedCatalogResponse = {
  status: 'OK';
  updatedAt: string | null;
  groups: CatalogGroup[] | Record<string, CatalogGroup>;
};
