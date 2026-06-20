import { readFileSync } from 'node:fs';

import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchAllSymbols: vi.fn(),
  upsertSectors: vi.fn(),
  upsertSymbols: vi.fn(),
  deactivateMissingSymbols: vi.fn(),
  findSymbols: vi.fn(),
  getLatestCatalogTimestamp: vi.fn()
}));

vi.mock('../src/services/brsClient', () => ({
  brsClient: {
    fetchAllSymbols: mocks.fetchAllSymbols
  },
  BrsApiError: class BrsApiError extends Error {}
}));

vi.mock('../src/repositories/symbolCatalog.repository', () => ({
  symbolCatalogRepository: {
    upsertSectors: mocks.upsertSectors,
    upsertSymbols: mocks.upsertSymbols,
    deactivateMissingSymbols: mocks.deactivateMissingSymbols,
    findSymbols: mocks.findSymbols,
    getLatestCatalogTimestamp: mocks.getLatestCatalogTimestamp
  }
}));

import { classifyInstrument } from '../src/utils/instrumentClassifier';
import { symbolCatalogService, normalizeBrsSymbol } from '../src/services/symbolCatalog.service';

describe('symbol catalog classifier', () => {
  it('keeps Symbol.symbol and Symbol.name while adding catalog fields in Prisma schema', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const migration = readFileSync(
      'prisma/migrations/20260620095514_symbol_catalog/migration.sql',
      'utf8'
    );

    expect(schema).toContain('model Symbol {');
    expect(schema).toContain('symbol         String   @unique');
    expect(schema).toContain('name           String?');
    expect(schema).toContain('instrumentType String   @default("UNKNOWN")');
    expect(schema).toContain('model Sector {');
    expect(migration).toContain('ALTER TABLE "Symbol" ADD COLUMN');
    expect(migration).toContain('CREATE TABLE "Sector"');
  });

  it('detects RIGHT when symbol ends with ح', () => {
    expect(classifyInstrument({ l18: 'خودروح', l30: 'حق تقدم خودرو' })).toBe('RIGHT');
  });

  it('detects ETF by صندوق', () => {
    expect(classifyInstrument({ l18: 'دارا', l30: 'صندوق سرمایه گذاری' })).toBe('ETF');
  });

  it('detects BOND by اوراق or اخزا or تسهیلات', () => {
    expect(classifyInstrument({ l18: 'اخزا123', l30: 'اوراق خزانه' })).toBe('BOND');
    expect(classifyInstrument({ l18: 'تسه1', l30: 'تسهیلات مسکن' })).toBe('BOND');
  });

  it('returns STOCK for a normal row', () => {
    expect(
      classifyInstrument({
        l18: 'خودرو',
        l30: 'ایران خودرو',
        cs: 'خودرو و ساخت قطعات'
      })
    ).toBe('STOCK');
  });

  it('normalizes BRS symbol using l18 and l30', () => {
    const normalized = normalizeBrsSymbol({
      l18: ' خودرو ',
      l30: ' ایران خودرو ',
      isin: 'IRO1IKCO0001',
      id: 123,
      cs: 'خودرو و ساخت قطعات',
      cs_id: 34
    });

    expect(normalized).toMatchObject({
      symbol: 'خودرو',
      name: 'ایران خودرو',
      isin: 'IRO1IKCO0001',
      tsetmcId: '123',
      sectorId: '34',
      sectorName: 'خودرو و ساخت قطعات',
      displaySector: 'خودرویی‌ها',
      instrumentType: 'STOCK',
      isActive: true
    });
  });
});

describe('symbol catalog service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deactivateMissingSymbols.mockResolvedValue({ count: 0 });
    mocks.upsertSectors.mockResolvedValue(undefined);
    mocks.upsertSymbols.mockResolvedValue(undefined);
    mocks.getLatestCatalogTimestamp.mockResolvedValue(
      new Date('2026-06-20T10:30:00.000Z')
    );
  });

  it('imports symbols by upserting and does not rely on deletion', async () => {
    mocks.fetchAllSymbols.mockResolvedValue([
      {
        l18: 'خودرو',
        l30: 'ایران خودرو',
        cs: 'خودرو و ساخت قطعات',
        cs_id: 34
      },
      {
        l18: 'دارا',
        l30: 'صندوق دارا'
      }
    ]);

    const result = await symbolCatalogService.importSymbols();

    expect(mocks.upsertSectors).toHaveBeenCalledTimes(1);
    expect(mocks.upsertSymbols).toHaveBeenCalledTimes(1);
    expect(mocks.upsertSymbols.mock.calls[0]?.[0]).toHaveLength(2);
    expect(mocks.deactivateMissingSymbols).toHaveBeenCalledWith(['خودرو', 'دارا']);
    expect(result.summary.upserted).toBe(2);
    expect(result.summary.stocks).toBe(1);
    expect(result.summary.etfs).toBe(1);
  });

  it('marks missing old rows inactive', async () => {
    mocks.fetchAllSymbols.mockResolvedValue([
      {
        l18: 'خودرو',
        l30: 'ایران خودرو',
        cs: 'خودرو و ساخت قطعات',
        cs_id: 34
      }
    ]);
    mocks.deactivateMissingSymbols.mockResolvedValue({ count: 5 });

    const result = await symbolCatalogService.importSymbols();

    expect(result.summary.deactivated).toBe(5);
    expect(mocks.deactivateMissingSymbols).toHaveBeenCalledWith(['خودرو']);
  });

  it('returns STOCK grouped by sector', async () => {
    mocks.findSymbols.mockResolvedValue([
      {
        symbol: 'خودرو',
        name: 'ایران خودرو',
        isin: 'IRO1IKCO0001',
        sectorId: '34',
        sectorName: 'خودرو و ساخت قطعات',
        displaySector: 'خودرویی‌ها',
        instrumentType: 'STOCK'
      },
      {
        symbol: 'خساپا',
        name: 'سایپا',
        isin: null,
        sectorId: '34',
        sectorName: 'خودرو و ساخت قطعات',
        displaySector: 'خودرویی‌ها',
        instrumentType: 'STOCK'
      }
    ]);

    const result = await symbolCatalogService.getGroupedCatalog({
      includeInactive: false,
      format: 'array'
    });

    expect(Array.isArray(result.groups)).toBe(true);
    expect(result.groups).toMatchObject([
      {
        key: 'stock',
        label: 'سهام',
        symbolCount: 2,
        children: [
          {
            key: 'sector:34',
            sectorId: '34',
            label: 'خودرو و ساخت قطعات',
            displayLabel: 'خودرویی‌ها',
            symbolCount: 2
          }
        ]
      }
    ]);
  });

  it('returns ETF as a top-level group', async () => {
    mocks.findSymbols.mockResolvedValue([
      {
        symbol: 'دارا',
        name: 'صندوق دارا',
        isin: null,
        sectorId: null,
        sectorName: null,
        displaySector: null,
        instrumentType: 'ETF'
      }
    ]);

    const result = await symbolCatalogService.getGroupedCatalog({
      includeInactive: false,
      format: 'array'
    });

    expect(result.groups).toMatchObject([
      {
        key: 'etf',
        label: 'صندوق‌های قابل معامله',
        symbolCount: 1
      }
    ]);
  });

  it('supports search', async () => {
    mocks.findSymbols.mockResolvedValue([
      {
        symbol: 'خودرو',
        name: 'ایران خودرو',
        isin: null,
        sectorId: '34',
        sectorName: 'خودرو و ساخت قطعات',
        displaySector: 'خودرویی‌ها',
        instrumentType: 'STOCK'
      }
    ]);

    const result = await symbolCatalogService.searchSymbols('خودرو');

    expect(mocks.findSymbols).toHaveBeenCalledWith({
      includeInactive: false,
      search: 'خودرو'
    });
    expect(result.results[0]).toMatchObject({
      code: 'خودرو',
      label: 'ایران خودرو'
    });
  });

  it('supports includeTypes', async () => {
    mocks.findSymbols.mockResolvedValue([]);

    await symbolCatalogService.getGroupedCatalog({
      includeInactive: false,
      includeTypes: ['ETF'],
      format: 'array'
    });

    expect(mocks.findSymbols).toHaveBeenCalledWith({
      includeInactive: false,
      includeTypes: ['ETF'],
      search: undefined
    });
  });
});
