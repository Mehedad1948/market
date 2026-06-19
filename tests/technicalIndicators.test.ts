import type { SymbolDailyMetric } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  calculateAdxAnalysis,
  calculateAtrAnalysis
} from '../src/services/technicalIndicators.service';

const buildRow = (
  index: number,
  overrides?: Partial<SymbolDailyMetric>
): SymbolDailyMetric => {
  return {
    id: `row-${index}`,
    symbol: 'TEST',
    date: `1403-01-${String(index + 1).padStart(2, '0')}`,
    time: null,
    tradeCount: BigInt(index + 1),
    tradeVolume: 1_000 + index,
    tradeValue: 2_000 + index,
    priceMin: 100 + index,
    priceMax: 110 + index,
    priceYesterday: null,
    priceFirst: null,
    priceLast: null,
    priceLastChange: null,
    priceLastChangePercent: null,
    closePrice: 105 + index,
    closePriceChange: null,
    closePriceChangePercent: 1,
    rawJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

describe('technicalIndicators.service', () => {
  it('calculates ATR from a constant true-range sample', () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      buildRow(index, {
        priceMin: 100 + index,
        priceMax: 110 + index,
        closePrice: 108 + index
      })
    );

    const atr = calculateAtrAnalysis(rows, 14);

    expect(atr.status).toBe('OK');
    expect(atr.latestAtr).toBe(10);
    expect(atr.latestAtrPercent).toBeCloseTo(10 / 127, 4);
    expect(atr.volatilityRegime).toBe('HIGH');
  });

  it('calculates ADX from a strong directional uptrend sample', () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      buildRow(index, {
        priceMin: 100 + index * 2,
        priceMax: 110 + index * 2,
        closePrice: 108 + index * 2
      })
    );

    const adx = calculateAdxAnalysis(rows, 14);

    expect(adx.status).toBe('OK');
    expect(adx.latestAdx).toBe(100);
    expect(adx.latestPlusDi).toBeGreaterThan(0);
    expect(adx.latestMinusDi).toBe(0);
    expect(adx.trendStrength).toBe('STRONG');
    expect(adx.bullishDirectionalBias).toBe(true);
    expect(adx.bearishDirectionalBias).toBe(false);
  });
});
