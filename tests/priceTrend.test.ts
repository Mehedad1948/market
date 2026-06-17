import type { SymbolDailyMetric } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  calculateEmaSeries,
  calculatePriceTrendAnalysis,
  calculateSmaSeries
} from '../src/services/priceTrend.service';
import type { PriceTrendConfig } from '../src/types';

const baseConfig: PriceTrendConfig = {
  fastWindow: 2,
  midWindow: 3,
  longWindow: 4,
  maType: 'SMA',
  minSlope: 0
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

describe('priceTrend.service', () => {
  it('calculates SMA and EMA series with null warmup', () => {
    expect(calculateSmaSeries([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    expect(calculateEmaSeries([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it('returns INSUFFICIENT_DATA when not enough close prices exist', () => {
    const analysis = calculatePriceTrendAnalysis(createRows([100, 101, 102]), {
      ...baseConfig,
      longWindow: 4
    });

    expect(analysis.status).toBe('INSUFFICIENT_DATA');
    expect(analysis.direction).toBe('INSUFFICIENT_DATA');
  });

  it('returns BULLISH when close is above rising fast, mid, and long MAs', () => {
    const analysis = calculatePriceTrendAnalysis(
      createRows([1, 2, 3, 4, 5, 6, 7, 8]),
      baseConfig
    );

    expect(analysis.direction).toBe('BULLISH');
    expect(analysis.bullish).toBe(true);
    expect(analysis.closeAboveFastMa).toBe(true);
    expect(analysis.fastAboveMidMa).toBe(true);
    expect(analysis.midAboveLongMa).toBe(true);
  });

  it('returns BEARISH when close is below falling fast, mid, and long MAs', () => {
    const analysis = calculatePriceTrendAnalysis(
      createRows([8, 7, 6, 5, 4, 3, 2, 1]),
      baseConfig
    );

    expect(analysis.direction).toBe('BEARISH');
    expect(analysis.bearish).toBe(true);
    expect(analysis.warning).toBe(true);
  });

  it('returns WEAKENING when close is below fast MA and fast slope is negative', () => {
    const analysis = calculatePriceTrendAnalysis(
      createRows([1, 2, 3, 4, 5, 4, 3]),
      baseConfig
    );

    expect(analysis.direction).toBe('WEAKENING');
    expect(analysis.warning).toBe(true);
  });

  it('handles null closePrice rows safely', () => {
    const analysis = calculatePriceTrendAnalysis(
      createRows([1, null, 2, 3, null, 4, 5, 6]),
      baseConfig
    );

    expect(analysis.status).toBe('OK');
    expect(analysis.latestDate).toBe('1403-01-08');
    expect(analysis.latestClosePrice).toBe(6);
  });
});
