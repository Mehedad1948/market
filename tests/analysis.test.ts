import type { SymbolDailyMetric } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  analyzeSymbolMetrics,
  calculateBuyTimeframes,
  calculateConfidence,
  classifyRegime,
  isAboveBy
} from '../src/services/analysis.service';

describe('analysis.service', () => {
  it('classifies strong bullish liquidity', () => {
    const regime = classifyRegime({
      maWeekly: 120,
      maMonthly: 100,
      maQuarterly: 90,
      weeklySlope: 0.2,
      monthlySlope: 0.1,
      quarterlySlope: 0.05,
      crossWeeklyAboveMonthly: true,
      crossWeeklyBelowMonthly: false,
      crossMonthlyAboveQuarterly: true,
      crossMonthlyBelowQuarterly: false
    });

    expect(regime).toBe('STRONG_BULLISH_LIQUIDITY');
  });

  it('classifies early bullish before monthly clears quarterly', () => {
    const regime = classifyRegime({
      maWeekly: 120,
      maMonthly: 110,
      maQuarterly: 115,
      weeklySlope: 0.1,
      monthlySlope: 0.01,
      quarterlySlope: 0,
      crossWeeklyAboveMonthly: true,
      crossWeeklyBelowMonthly: false,
      crossMonthlyAboveQuarterly: false,
      crossMonthlyBelowQuarterly: false
    });

    expect(regime).toBe('EARLY_BULLISH');
  });

  it('returns high confidence when signals align', () => {
    const confidence = calculateConfidence('CONFIRMED_BULLISH', {
      maWeekly: 130,
      maMonthly: 120,
      maQuarterly: 100,
      weeklySlope: 0.1,
      monthlySlope: 0.08,
      quarterlySlope: 0.04,
      crossWeeklyAboveMonthly: false,
      crossWeeklyBelowMonthly: false,
      crossMonthlyAboveQuarterly: true,
      crossMonthlyBelowQuarterly: false
    });

    expect(confidence).toBe('HIGH');
  });

  it('shortTerm is true when weekly conditions are satisfied', () => {
    const buy = calculateBuyTimeframes({
      latestTradeValue: 130,
      maWeekly: 120,
      maMonthly: 100,
      maQuarterly: 90,
      weeklySlope: 0.06,
      monthlySlope: 0.03,
      quarterlySlope: 0.01
    });

    expect(buy.shortTerm).toBe(true);
  });

  it('midTerm is true when monthly conditions are satisfied', () => {
    const buy = calculateBuyTimeframes({
      latestTradeValue: 140,
      maWeekly: 125,
      maMonthly: 120,
      maQuarterly: 100,
      weeklySlope: 0.04,
      monthlySlope: 0.05,
      quarterlySlope: 0.02
    });

    expect(buy.midTerm).toBe(true);
  });

  it('longTerm is true when quarterly conditions are satisfied', () => {
    const buy = calculateBuyTimeframes({
      latestTradeValue: 150,
      maWeekly: 128,
      maMonthly: 118,
      maQuarterly: 100,
      weeklySlope: 0.04,
      monthlySlope: 0.03,
      quarterlySlope: 0.02
    });

    expect(buy.longTerm).toBe(true);
  });

  it('shortTerm and midTerm stay false when MA difference is below threshold', () => {
    const threshold = 0.02;
    const buy = calculateBuyTimeframes(
      {
        latestTradeValue: 120,
        maWeekly: 101.5,
        maMonthly: 100,
        maQuarterly: 99,
        weeklySlope: 0.04,
        monthlySlope: 0.03,
        quarterlySlope: 0.01
      },
      threshold
    );

    expect(isAboveBy(101.5, 100, threshold)).toBe(false);
    expect(buy.shortTerm).toBe(false);
    expect(buy.midTerm).toBe(false);
  });

  it('analysis response contains signals.buy and keeps existing signal fields', () => {
    const rows = Array.from({ length: 90 }, (_, index) => {
      const tradeValue = 1_000 + index * 50;

      return {
        id: `row-${index}`,
        symbol: 'فملی',
        date: `1403-${String(Math.floor(index / 30) + 1).padStart(2, '0')}-${String((index % 30) + 1).padStart(2, '0')}`,
        time: null,
        tradeCount: BigInt(index + 1),
        tradeVolume: tradeValue,
        tradeValue,
        priceMin: null,
        priceMax: null,
        priceYesterday: null,
        priceFirst: null,
        priceLast: null,
        priceLastChange: null,
        priceLastChangePercent: null,
        closePrice: 4_000 + index,
        closePriceChange: null,
        closePriceChangePercent: 1.25,
        rawJson: {},
        createdAt: new Date(),
        updatedAt: new Date()
      } as SymbolDailyMetric;
    });

    const result = analyzeSymbolMetrics(
      'فملی',
      rows,
      {
        weeklyWindow: 7,
        monthlyWindow: 30,
        quarterlyWindow: 90,
        forceRefresh: false,
        includeRealLegal: false
      },
      'database',
      false
    );

    expect(result.signals).toMatchObject({
      regime: expect.any(String),
      crossWeeklyAboveMonthly: expect.any(Boolean),
      crossWeeklyBelowMonthly: expect.any(Boolean),
      crossMonthlyAboveQuarterly: expect.any(Boolean),
      crossMonthlyBelowQuarterly: expect.any(Boolean),
      confidence: expect.any(String),
      buy: {
        shortTerm: expect.any(Boolean),
        midTerm: expect.any(Boolean),
        longTerm: expect.any(Boolean)
      }
    });
    expect('bullish' in result.signals).toBe(false);
  });
});
