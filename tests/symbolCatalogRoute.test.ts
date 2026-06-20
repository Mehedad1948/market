import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importSymbols: vi.fn(),
  getGroupedCatalog: vi.fn(),
  searchSymbols: vi.fn()
}));

vi.mock('../src/services/symbolCatalog.service', () => ({
  normalizeBrsSymbol: vi.fn(),
  symbolCatalogService: {
    importSymbols: mocks.importSymbols,
    getGroupedCatalog: mocks.getGroupedCatalog,
    searchSymbols: mocks.searchSymbols
  }
}));

vi.mock('../src/services/signalScan.service', () => ({
  signalScanService: {
    runScan: vi.fn().mockResolvedValue({
      status: 'OK',
      scannedAt: '2026-06-19T12:00:00.000Z',
      symbolsRequested: 0,
      scannedCount: 0,
      okCount: 0,
      insufficientDataCount: 0,
      errorCount: 0,
      results: []
    })
  }
}));

import { createApp } from '../src/app';

describe('symbol catalog routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = '';

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports symbols manually', async () => {
    mocks.importSymbols.mockResolvedValue({
      status: 'OK',
      source: 'brsapi',
      importedAt: '2026-06-20T10:30:00.000Z',
      summary: {
        fetched: 10,
        upserted: 10,
        stocks: 8,
        etfs: 1,
        rights: 0,
        bonds: 0,
        unknown: 1,
        deactivated: 0,
        sectors: 2
      }
    });

    const response = await fetch(`${baseUrl}/api/symbols/import`, {
      method: 'POST'
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      source: 'brsapi'
    });
  });

  it('grouped route defaults to macro grouping and hideDuplicateBoards=true', async () => {
    mocks.getGroupedCatalog.mockResolvedValue({
      status: 'OK',
      grouping: 'macro',
      updatedAt: '2026-06-20T10:30:00.000Z',
      groups: [
        {
          key: 'bank',
          label: 'بانکی',
          symbolCount: 1,
          symbols: []
        }
      ]
    });

    const response = await fetch(
      `${baseUrl}/api/symbols/grouped?includeTypes=STOCK,ETF&search=%D8%AE%D9%88%D8%AF%D8%B1%D9%88`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      grouping: 'macro',
      groups: [{ key: 'bank' }]
    });
    expect(mocks.getGroupedCatalog).toHaveBeenCalledWith({
      grouping: 'macro',
      hideDuplicateBoards: true,
      includeInactive: false,
      includeTypes: ['STOCK', 'ETF'],
      search: 'خودرو',
      format: 'array'
    });
  });

  it('grouped route accepts official grouping override', async () => {
    mocks.getGroupedCatalog.mockResolvedValue({
      status: 'OK',
      grouping: 'official',
      updatedAt: '2026-06-20T10:30:00.000Z',
      groups: []
    });

    const response = await fetch(
      `${baseUrl}/api/symbols/grouped?grouping=official&hideDuplicateBoards=false`
    );

    expect(response.status).toBe(200);
    expect(mocks.getGroupedCatalog).toHaveBeenCalledWith({
      grouping: 'official',
      hideDuplicateBoards: false,
      includeInactive: false,
      format: 'array'
    });
  });

  it('searches symbols', async () => {
    mocks.searchSymbols.mockResolvedValue({
      status: 'OK',
      query: 'خودرو',
      results: [
        {
          code: 'خودرو',
          label: 'ایران خودرو'
        }
      ]
    });

    const response = await fetch(
      `${baseUrl}/api/symbols/search?q=%D8%AE%D9%88%D8%AF%D8%B1%D9%88`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'OK',
      query: 'خودرو',
      results: [{ code: 'خودرو' }]
    });
  });
});
