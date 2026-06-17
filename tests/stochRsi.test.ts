import type { SymbolDailyMetric } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  calculateRsiSeries,
  calculateStochRsiAnalysis,
  calculateStochRsiSeries,
  buildStochRsiPoints,
  smoothSma
} from '../src/services/stochRsi.service';
import type { StochRsiConfig } from '../src/types';

const defaultConfig: StochRsiConfig = {
  rsiLength: 3,
  stochLength: 3,
  kSmooth: 2,
  dSmooth: 2,
  upper: 80,
  lower: 20,
  sellLookback: 8,
  buyLookback: 4,
  signalMaxAge: 3,
  minCrossDistance: 1
};

const createRows = (closes: Array<number | null>): SymbolDailyMetric[] => {
  return closes.map((closePrice, index) => ({
    id: `row-${index}`,
    symbol: 'TEST',
    date: `1403-01-${String(index + 1).padStart(2, '0')}`,
    time: null,
    tradeCount: 1n,
    tradeVolume: 1_000,
    tradeValue: 1_000,
    priceMin: null,
    priceMax: null,
    priceYesterday: null,
    priceFirst: null,
    priceLast: null,
    priceLastChange: null,
    priceLastChangePercent: null,
    closePrice,
    closePriceChange: null,
    closePriceChangePercent: null,
    rawJson: {},
    createdAt: new Date(),
    updatedAt: new Date()
  })) as SymbolDailyMetric[];
};

describe('stochRsi.service', () => {
  it('returns aligned series with expected null warmup', () => {
    const closes = [100, 98, 96, 94, 92, 94, 96, 98];
    const rsiSeries = calculateRsiSeries(closes, 3);
    const stochSeries = calculateStochRsiSeries(rsiSeries, 3);
    const kSeries = smoothSma(stochSeries, 2);
    const dSeries = smoothSma(kSeries, 2);

    expect(rsiSeries).toHaveLength(closes.length);
    expect(stochSeries).toHaveLength(closes.length);
    expect(kSeries).toHaveLength(closes.length);
    expect(dSeries).toHaveLength(closes.length);
    expect(rsiSeries.slice(0, 3)).toEqual([null, null, null]);
    expect(stochSeries.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(kSeries.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(dSeries.at(-1)).not.toBeNull();
  });

  it('detects a green-zone bullish cross', () => {
    const rows = createRows([
      100, 98, 96, 94, 92, 94, 96, 98, 96, 94, 92, 90, 92
    ]);
    const points = buildStochRsiPoints(rows, defaultConfig);

    expect(points.at(-1)?.crossUpInGreen).toBe(true);
    expect(points.at(-1)?.crossUp).toBe(true);
  });

  it('detects a red-zone bearish cross', () => {
    const rows = createRows([100, 98, 96, 94, 92, 94, 96, 98, 96]);
    const points = buildStochRsiPoints(rows, defaultConfig);

    expect(points.at(-1)?.crossDownInRed).toBe(true);
    expect(points.at(-1)?.crossDown).toBe(true);
  });

  it('marks probableBuy after one valid green-zone bullish cross', () => {
    const rows = createRows([
      100, 98, 96, 94, 92, 94, 96, 98, 96, 94, 92, 90, 92, 94
    ]);
    const analysis = calculateStochRsiAnalysis(rows, defaultConfig);

    expect(analysis.probableBuy).toBe(true);
    expect(analysis.greenBullishCrossCount).toBeGreaterThanOrEqual(1);
  });

  it('marks riskSell after two red-zone bearish crosses inside lookback', () => {
    const rows = createRows([
      100, 98, 96, 94, 92, 94, 96, 98, 96, 94, 96, 98, 96, 94, 92
    ]);
    const analysis = calculateStochRsiAnalysis(rows, defaultConfig);

    expect(analysis.redBearishCrossCount).toBeGreaterThanOrEqual(2);
    expect(analysis.riskSell).toBe(true);
  });

  it('marks confirmedSell when riskSell is active and K is below D below upper threshold', () => {
    const rows = createRows([
      100, 98, 96, 94, 92, 94, 96, 98, 96, 94, 96, 98, 97
    ]);
    const analysis = calculateStochRsiAnalysis(rows, defaultConfig);

    expect(analysis.riskSell).toBe(true);
    expect(analysis.latestK).not.toBeNull();
    expect(analysis.latestD).not.toBeNull();
    expect(analysis.latestK!).toBeLessThan(analysis.latestD!);
    expect(analysis.latestK!).toBeLessThan(defaultConfig.upper);
    expect(analysis.confirmedSell).toBe(true);
  });

  it('returns INSUFFICIENT_DATA without breaking alignment when closes are missing', () => {
    const rows = createRows([100, null, 99, null, 98, 97]);
    const analysis = calculateStochRsiAnalysis(rows, defaultConfig);

    expect(analysis.status).toBe('INSUFFICIENT_DATA');
    expect(analysis.latestDate).toBe('1403-01-06');
  });
});
