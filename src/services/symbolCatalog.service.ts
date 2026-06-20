import type { Symbol as PrismaSymbol } from '@prisma/client';

import { brsClient } from './brsClient';
import { symbolCatalogRepository } from '../repositories/symbolCatalog.repository';
import type {
  BrsAllSymbolItem,
  CatalogChildGroup,
  CatalogGroup,
  CatalogSymbolItem,
  GroupedCatalogResponse,
  InstrumentType,
  NormalizedCatalogSymbol,
  SymbolGroupingMode
} from '../types/symbolCatalog';
import { classifyInstrument } from '../utils/instrumentClassifier';
import { getDisplaySector } from '../utils/sectorDisplay';
import {
  getBaseSymbolCode,
  isDuplicateBoardSymbol,
  type MarketGroupInfo,
  resolveMarketGroup
} from '../utils/marketGroup';

const topLevelLabels: Record<InstrumentType, string> = {
  STOCK: 'سهام',
  ETF: 'صندوق‌های قابل معامله',
  RIGHT: 'حق‌تقدم‌ها',
  BOND: 'اوراق بدهی',
  UNKNOWN: 'سایر نمادها'
};

const topLevelKeys: Record<InstrumentType, string> = {
  STOCK: 'stock',
  ETF: 'etf',
  RIGHT: 'right',
  BOND: 'bond',
  UNKNOWN: 'unknown'
};

const compareCatalogItems = (a: CatalogSymbolItem, b: CatalogSymbolItem) => {
  return (
    a.label.localeCompare(b.label, 'fa') || a.code.localeCompare(b.code, 'fa')
  );
};

const toCatalogItem = (
  symbol: PrismaSymbol,
  allCodes: Set<string>
): CatalogSymbolItem => {
  const marketGroup = resolveMarketGroup({
    instrumentType: symbol.instrumentType as InstrumentType,
    sectorName: symbol.sectorName
  });
  const duplicateBoard = isDuplicateBoardSymbol(symbol.symbol, allCodes);

  return {
    code: symbol.symbol,
    label: symbol.name ?? symbol.symbol,
    isin: symbol.isin ?? null,
    sectorId: symbol.sectorId ?? null,
    sectorName: symbol.sectorName ?? null,
    displaySector: symbol.displaySector ?? null,
    instrumentType: symbol.instrumentType as InstrumentType,
    marketGroupKey: marketGroup.key,
    marketGroupLabel: marketGroup.label,
    marketGroupIcon: marketGroup.icon,
    baseCode: getBaseSymbolCode(symbol.symbol),
    isDuplicateBoard: duplicateBoard
  };
};

export const normalizeBrsSymbol = (
  item: BrsAllSymbolItem
): NormalizedCatalogSymbol | null => {
  const symbol = item.l18?.trim();
  const name = item.l30?.trim() || symbol;
  const sectorName = item.cs?.trim() || null;
  const instrumentType = classifyInstrument(item);

  if (!symbol || !name) {
    return null;
  }

  return {
    symbol,
    name,
    isin: item.isin ? String(item.isin) : null,
    tsetmcId: item.id ? String(item.id) : null,
    sectorId: item.cs_id ? String(item.cs_id) : null,
    sectorName,
    displaySector: getDisplaySector(sectorName),
    instrumentType,
    isActive: true,
    rawJson: item,
    lastSeenAt: new Date()
  };
};

const dedupeNormalizedSymbols = (
  rows: NormalizedCatalogSymbol[]
): NormalizedCatalogSymbol[] => {
  const seen = new Map<string, NormalizedCatalogSymbol>();

  for (const row of rows) {
    seen.set(row.symbol, row);
  }

  return [...seen.values()].sort((a, b) => a.symbol.localeCompare(b.symbol, 'fa'));
};

const buildOfficialStockGroups = (
  symbols: PrismaSymbol[],
  allCodes: Set<string>
): CatalogGroup | null => {
  if (symbols.length === 0) {
    return null;
  }

  const groups = new Map<string, CatalogChildGroup>();

  for (const symbol of symbols) {
    const sectorId = symbol.sectorId ?? null;
    const sectorName = symbol.sectorName ?? 'نامشخص';
    const displayLabel = symbol.displaySector ?? sectorName;
    const key = `sector:${sectorId ?? 'unknown'}`;
    const group = groups.get(key) ?? {
      key,
      sectorId,
      label: sectorName,
      displayLabel,
      symbolCount: 0,
      symbols: []
    };

    group.symbols.push(toCatalogItem(symbol, allCodes));
    group.symbolCount += 1;
    groups.set(key, group);
  }

  const children = [...groups.values()]
    .map((group) => ({
      ...group,
      symbols: group.symbols.sort(compareCatalogItems)
    }))
    .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel, 'fa'));

  return {
    key: topLevelKeys.STOCK,
    label: topLevelLabels.STOCK,
    symbolCount: symbols.length,
    children
  };
};

const buildFlatGroupFromMarketGroup = (
  marketGroup: MarketGroupInfo,
  symbols: PrismaSymbol[],
  allCodes: Set<string>
): CatalogGroup | null => {
  if (symbols.length === 0) {
    return null;
  }

  return {
    key: marketGroup.key,
    label: marketGroup.label,
    icon: marketGroup.icon,
    sortOrder: marketGroup.sortOrder,
    symbolCount: symbols.length,
    symbols: symbols
      .map((symbol) => toCatalogItem(symbol, allCodes))
      .sort(compareCatalogItems)
  };
};

const buildOfficialFlatGroup = (
  instrumentType: Exclude<InstrumentType, 'STOCK'>,
  symbols: PrismaSymbol[],
  allCodes: Set<string>
): CatalogGroup | null => {
  if (symbols.length === 0) {
    return null;
  }

  return {
    key: topLevelKeys[instrumentType],
    label: topLevelLabels[instrumentType],
    symbolCount: symbols.length,
    symbols: symbols
      .map((symbol) => toCatalogItem(symbol, allCodes))
      .sort(compareCatalogItems)
  };
};

const buildMacroGroups = (
  symbols: PrismaSymbol[],
  allCodes: Set<string>
): CatalogGroup[] => {
  const grouped = new Map<string, { info: MarketGroupInfo; symbols: PrismaSymbol[] }>();

  for (const symbol of symbols) {
    const info = resolveMarketGroup({
      instrumentType: symbol.instrumentType as InstrumentType,
      sectorName: symbol.sectorName
    });
    const entry = grouped.get(info.key) ?? { info, symbols: [] };
    entry.symbols.push(symbol);
    grouped.set(info.key, entry);
  }

  return [...grouped.values()]
    .map(({ info, symbols: groupSymbols }) =>
      buildFlatGroupFromMarketGroup(info, groupSymbols, allCodes)
    )
    .filter((group): group is CatalogGroup => group !== null)
    .sort((a, b) => {
      const left = a.sortOrder ?? 999;
      const right = b.sortOrder ?? 999;
      return left - right || a.label.localeCompare(b.label, 'fa');
    });
};

const buildObjectGroups = (groups: CatalogGroup[]) => {
  return Object.fromEntries(groups.map((group) => [group.key, group]));
};

export const symbolCatalogService = {
  async importSymbols() {
    const importedAt = new Date();
    const fetched = await brsClient.fetchAllSymbols(1);
    const normalized = dedupeNormalizedSymbols(
      fetched
        .map((item) => normalizeBrsSymbol(item))
        .filter((item): item is NormalizedCatalogSymbol => item !== null)
        .map((item) => ({
          ...item,
          lastSeenAt: importedAt
        }))
    );

    const sectors = [...new Map(
      normalized
        .filter((row) => row.sectorId && row.sectorName)
        .map((row) => [
          row.sectorId as string,
          {
            id: row.sectorId as string,
            name: row.sectorName as string,
            displayName: row.displaySector
          }
        ])
    ).values()];

    await symbolCatalogRepository.upsertSectors(sectors);
    await symbolCatalogRepository.upsertSymbols(normalized);
    const deactivated =
      normalized.length > 0
        ? await symbolCatalogRepository.deactivateMissingSymbols(
            normalized.map((row) => row.symbol)
          )
        : { count: 0 };

    const summary = {
      fetched: fetched.length,
      upserted: normalized.length,
      stocks: normalized.filter((row) => row.instrumentType === 'STOCK').length,
      etfs: normalized.filter((row) => row.instrumentType === 'ETF').length,
      rights: normalized.filter((row) => row.instrumentType === 'RIGHT').length,
      bonds: normalized.filter((row) => row.instrumentType === 'BOND').length,
      unknown: normalized.filter((row) => row.instrumentType === 'UNKNOWN').length,
      deactivated: deactivated.count,
      sectors: sectors.length
    };

    return {
      status: 'OK' as const,
      source: 'brsapi' as const,
      importedAt: importedAt.toISOString(),
      summary
    };
  },

  async getGroupedCatalog(options: {
    grouping: SymbolGroupingMode;
    hideDuplicateBoards: boolean;
    includeInactive: boolean;
    includeTypes?: InstrumentType[];
    search?: string;
    format: 'array' | 'object';
  }): Promise<GroupedCatalogResponse> {
    const filters = {
      includeInactive: options.includeInactive,
      ...(options.includeTypes ? { includeTypes: options.includeTypes } : {}),
      ...(options.search ? { search: options.search } : {})
    };
    const dbSymbols = await symbolCatalogRepository.findSymbols(filters);
    const allCodes = new Set(dbSymbols.map((symbol) => symbol.symbol));
    const symbols = options.hideDuplicateBoards
      ? dbSymbols.filter(
          (symbol) => !isDuplicateBoardSymbol(symbol.symbol, allCodes)
        )
      : dbSymbols;

    const groups =
      options.grouping === 'official'
        ? [
            buildOfficialStockGroups(
              symbols.filter((symbol) => symbol.instrumentType === 'STOCK'),
              allCodes
            ),
            buildOfficialFlatGroup(
              'ETF',
              symbols.filter((symbol) => symbol.instrumentType === 'ETF'),
              allCodes
            ),
            buildOfficialFlatGroup(
              'RIGHT',
              symbols.filter((symbol) => symbol.instrumentType === 'RIGHT'),
              allCodes
            ),
            buildOfficialFlatGroup(
              'BOND',
              symbols.filter((symbol) => symbol.instrumentType === 'BOND'),
              allCodes
            ),
            buildOfficialFlatGroup(
              'UNKNOWN',
              symbols.filter((symbol) => symbol.instrumentType === 'UNKNOWN'),
              allCodes
            )
          ].filter((group): group is CatalogGroup => group !== null)
        : buildMacroGroups(symbols, allCodes);

    const updatedAt = await symbolCatalogRepository.getLatestCatalogTimestamp();

    return {
      status: 'OK',
      grouping: options.grouping,
      updatedAt: updatedAt?.toISOString() ?? null,
      groups:
        options.format === 'object' ? buildObjectGroups(groups) : groups
    };
  },

  async searchSymbols(query: string) {
    const symbols = await symbolCatalogRepository.findSymbols({
      includeInactive: false,
      search: query
    });

    return {
      status: 'OK' as const,
      query,
      results: symbols.map((symbol) => toCatalogItem(symbol, new Set(symbols.map((row) => row.symbol))))
    };
  }
};
