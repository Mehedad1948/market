import type { SymbolDailyMetric } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  analyzeSymbolMetrics,
  calculateBuyTimeframes,
  calculateCompositeSignal,
  calculateConfidence,
  calculateSellTimeframes,
  classifyRegime,
  isAboveBy
} from '../src/services/analysis.service';
import type { PriceTrendAnalysis, StochRsiAnalysis } from '../src/types';

const baseStochRsi: StochRsiAnalysis = {
  status: 'OK',
  latestDate: '1403-01-13',
  latestK: 50,
  latestD: 45,
  latestZone: 'NEUTRAL',
  upperThreshold: 80,
  lowerThreshold: 20,
  crossUpInGreen: false,
  crossDownInRed: false,
  redBearishCrossCount: 0,
  greenBullishCrossCount: 0,
  barsSinceLastGreenCrossUp: null,
  barsSinceLastRedCrossDown: null,
  probableBuy: false,
  riskSell: false,
  confirmedSell: false
};

const basePriceTrend: PriceTrendAnalysis = {
  status: 'OK',
  latestDate: '1403-01-13',
  latestClosePrice: 100,
  fastMa: 95,
  midMa: 90,
  longMa: 80,
  fastSlope: 0.01,
  midSlope: 0.01,
  longSlope: 0.01,
  closeAboveFastMa: true,
  closeAboveMidMa: true,
  closeAboveLongMa: true,
  fastAboveMidMa: true,
  midAboveLongMa: true,
  direction: 'NEUTRAL',
  bullish: false,
  bearish: false,
  warning: false
};

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
      },
      sell: {
        shortTerm: expect.any(Boolean),
        midTerm: expect.any(Boolean),
        longTerm: expect.any(Boolean)
      },
      stochRsi: {
        status: expect.any(String),
        probableBuy: expect.any(Boolean),
        riskSell: expect.any(Boolean),
        confirmedSell: expect.any(Boolean)
      },
      priceTrend: {
        status: expect.any(String),
        direction: expect.any(String),
        bullish: expect.any(Boolean),
        bearish: expect.any(Boolean),
        warning: expect.any(Boolean)
      },
      composite: {
        action: expect.any(String),
        score: expect.any(Number),
        explanationKey: expect.any(String),
        scoreScale: {
          min: -100,
          max: 100
        }
      }
    });
    expect('bullish' in result.signals).toBe(false);
  });

  it('composite action becomes PROBABLE_BUY when Stoch RSI buy exists and liquidity is not bearish', () => {
    const composite = calculateCompositeSignal(
      'EARLY_BULLISH',
      {
        shortTerm: true,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        probableBuy: true,
        greenBullishCrossCount: 1,
        crossUpInGreen: true
      },
      {
        ...basePriceTrend,
        direction: 'IMPROVING',
        bullish: true
      }
    );

    expect(composite.action).toBe('PROBABLE_BUY');
    expect(composite.score).toBeGreaterThan(0);
  });

  it('composite action becomes CONFIRMED_SELL when confirmedSell exists and liquidity is weak', () => {
    const composite = calculateCompositeSignal(
      'BEARISH_LIQUIDITY',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        latestK: 40,
        latestD: 60,
        riskSell: true,
        confirmedSell: true,
        redBearishCrossCount: 2,
        crossDownInRed: true
      },
      {
        ...basePriceTrend,
        direction: 'BEARISH',
        bearish: true,
        warning: true
      }
    );

    expect(composite.action).toBe('CONFIRMED_SELL');
    expect(composite.score).toBeLessThan(0);
  });

  it('existing liquidity signals still work alongside sell timeframes', () => {
    const buy = calculateBuyTimeframes({
      latestTradeValue: 150,
      maWeekly: 128,
      maMonthly: 118,
      maQuarterly: 100,
      weeklySlope: 0.04,
      monthlySlope: 0.03,
      quarterlySlope: 0.02
    });
    const sell = calculateSellTimeframes(
      'STRONG_BULLISH_LIQUIDITY',
      buy,
      baseStochRsi,
      basePriceTrend
    );

    expect(buy.longTerm).toBe(true);
    expect(sell).toEqual({
      shortTerm: false,
      midTerm: false,
      longTerm: false
    });
  });

  it('Stoch RSI confirmedSell applies -50 without also applying riskSell -25', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        riskSell: true,
        confirmedSell: true
      },
      basePriceTrend
    );

    expect(composite.score).toBe(-50);
  });

  it('riskSell without confirmedSell applies -25', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: true,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        riskSell: true
      },
      basePriceTrend
    );

    expect(composite.score).toBe(-5);
    expect(composite.action).toBe('CAUTION');
  });

  it('composite score clamps to +100 and -100', () => {
    const bullish = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: true
      },
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      }
    );
    const bearish = calculateCompositeSignal(
      'BEARISH_LIQUIDITY',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        riskSell: true,
        confirmedSell: true
      },
      {
        ...basePriceTrend,
        direction: 'BEARISH',
        bearish: true,
        warning: true
      }
    );

    expect(bullish.score).toBe(100);
    expect(bearish.score).toBe(-100);
  });

  it('STRONG_BUY requires liquidity buy, Stoch RSI buy, and bullish price trend', () => {
    const composite = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: false
      },
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      }
    );

    expect(composite.action).toBe('STRONG_BUY');
  });

  it('confirmedSell with strong liquidity and non-bearish price trend returns CAUTION', () => {
    const composite = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: true
      },
      {
        ...baseStochRsi,
        riskSell: true,
        confirmedSell: true
      },
      basePriceTrend
    );

    expect(composite.action).toBe('CAUTION');
    expect(composite.explanationKey).toBe(
      'composite.confirmedSellButTrendStrong'
    );
  });

  it('riskSell with weak short-term liquidity returns RISK_SELL', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: false
      },
      {
        ...baseStochRsi,
        riskSell: true
      },
      basePriceTrend
    );

    expect(composite.action).toBe('RISK_SELL');
  });

  it('probableBuy with improving price trend returns PROBABLE_BUY', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'IMPROVING',
        bullish: true
      }
    );

    expect(composite.action).toBe('PROBABLE_BUY');
  });

  it('mixed neutral signals return HOLD', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseStochRsi,
      basePriceTrend
    );

    expect(composite.action).toBe('HOLD');
  });
});
