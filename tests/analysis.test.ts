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
import type {
  AdxAnalysis,
  AtrAnalysis,
  LiquidityConfirmation,
  PriceTrendAnalysis,
  SellTimeframes,
  StochRsiAnalysis
} from '../src/types';

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

const baseAdx: AdxAnalysis = {
  status: 'OK',
  period: 14,
  latestAdx: 22,
  latestPlusDi: 24,
  latestMinusDi: 24,
  trendStrength: 'MODERATE',
  bullishDirectionalBias: false,
  bearishDirectionalBias: false
};

const baseAtr: AtrAnalysis = {
  status: 'OK',
  period: 14,
  latestAtr: 10,
  latestAtrPercent: 0.02,
  volatilityRegime: 'NORMAL'
};

const neutralLiquidityConfirmation: LiquidityConfirmation = {
  relativeTradeValue20: 1,
  liquidityExpansion: false,
  liquidityContraction: false
};

const baseSell: SellTimeframes = {
  shortTerm: false,
  midTerm: false,
  longTerm: false
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
      regime: {
        label: expect.any(String),
        value: expect.any(String)
      },
      crossWeeklyAboveMonthly: {
        label: expect.any(String),
        value: expect.any(Boolean)
      },
      crossWeeklyBelowMonthly: {
        label: expect.any(String),
        value: expect.any(Boolean)
      },
      crossMonthlyAboveQuarterly: {
        label: expect.any(String),
        value: expect.any(Boolean)
      },
      crossMonthlyBelowQuarterly: {
        label: expect.any(String),
        value: expect.any(Boolean)
      },
      confidence: {
        label: expect.any(String),
        value: expect.any(String)
      },
      buy: {
        shortTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        midTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        longTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        }
      },
      sell: {
        shortTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        midTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        longTerm: {
          label: expect.any(String),
          value: expect.any(Boolean)
        }
      },
      stochRsi: {
        status: {
          label: expect.any(String),
          value: expect.any(String)
        },
        latestZone: {
          label: expect.any(String),
          value: expect.any(String)
        },
        crossUpInGreen: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        crossDownInRed: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        probableBuy: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        riskSell: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        confirmedSell: {
          label: expect.any(String),
          value: expect.any(Boolean)
        }
      },
      priceTrend: {
        status: {
          label: expect.any(String),
          value: expect.any(String)
        },
        direction: {
          label: expect.any(String),
          value: expect.any(String)
        },
        bullish: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        bearish: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        warning: {
          label: expect.any(String),
          value: expect.any(Boolean)
        }
      },
      adx: {
        status: {
          label: expect.any(String),
          value: expect.any(String)
        },
        trendStrength: {
          label: expect.any(String),
          value: expect.any(String)
        },
        directionalBias: {
          label: expect.any(String),
          value: expect.any(String)
        },
        bullishDirectionalBias: {
          label: expect.any(String),
          value: expect.any(Boolean)
        },
        bearishDirectionalBias: {
          label: expect.any(String),
          value: expect.any(Boolean)
        }
      },
      atr: {
        status: {
          label: expect.any(String),
          value: expect.any(String)
        },
        volatilityRegime: {
          label: expect.any(String),
          value: expect.any(String)
        }
      },
      composite: {
        action: {
          label: expect.any(String),
          value: expect.any(String)
        },
        score: expect.any(Number),
        explanationKey: expect.any(String),
        scoreScale: {
          min: -100,
          max: 100
        }
      }
    });
    expect(result.metrics.relativeTradeValue20).toEqual(expect.any(Number));
    expect(typeof result.metrics.liquidityExpansion).toBe('boolean');
    expect(typeof result.metrics.liquidityContraction).toBe('boolean');
    expect('bullish' in result.signals).toBe(false);
  });

  it('sorts rows ascending before using latest row and calculations', () => {
    const rows = [
      {
        id: 'row-3',
        symbol: 'TEST',
        date: '1403-01-03',
        time: null,
        tradeCount: BigInt(3),
        tradeVolume: 300,
        tradeValue: 300,
        priceMin: 11,
        priceMax: 21,
        priceYesterday: null,
        priceFirst: null,
        priceLast: null,
        priceLastChange: null,
        priceLastChangePercent: null,
        closePrice: 15,
        closePriceChange: null,
        closePriceChangePercent: 1,
        rawJson: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'row-1',
        symbol: 'TEST',
        date: '1403-01-01',
        time: null,
        tradeCount: BigInt(1),
        tradeVolume: 100,
        tradeValue: 100,
        priceMin: 9,
        priceMax: 19,
        priceYesterday: null,
        priceFirst: null,
        priceLast: null,
        priceLastChange: null,
        priceLastChangePercent: null,
        closePrice: 13,
        closePriceChange: null,
        closePriceChangePercent: 1,
        rawJson: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'row-2',
        symbol: 'TEST',
        date: '1403-01-02',
        time: null,
        tradeCount: BigInt(2),
        tradeVolume: 200,
        tradeValue: 200,
        priceMin: 10,
        priceMax: 20,
        priceYesterday: null,
        priceFirst: null,
        priceLast: null,
        priceLastChange: null,
        priceLastChangePercent: null,
        closePrice: 14,
        closePriceChange: null,
        closePriceChangePercent: 1,
        rawJson: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ] as SymbolDailyMetric[];

    const result = analyzeSymbolMetrics(
      'TEST',
      rows,
      {
        weeklyWindow: 1,
        monthlyWindow: 2,
        quarterlyWindow: 3,
        forceRefresh: false,
        includeRealLegal: false
      },
      'database',
      false
    );

    expect(result.latestDataDate).toBe('1403-01-03');
    expect(result.metrics.latestTradeValue).toBe(300);
  });

  it('throws when latest trade value is missing instead of treating it as zero', () => {
    const rows = Array.from({ length: 91 }, (_, index) => ({
      id: `row-${index}`,
      symbol: 'TEST',
      date: `1403-${String(Math.floor(index / 30) + 1).padStart(2, '0')}-${String((index % 30) + 1).padStart(2, '0')}`,
      time: null,
      tradeCount: BigInt(index + 1),
      tradeVolume: 1_000 + index,
      tradeValue: index === 90 ? null : 1_000 + index,
      priceMin: 100 + index,
      priceMax: 110 + index,
      priceYesterday: null,
      priceFirst: null,
      priceLast: null,
      priceLastChange: null,
      priceLastChangePercent: null,
      closePrice: 200 + index,
      closePriceChange: null,
      closePriceChangePercent: 1,
      rawJson: {},
      createdAt: new Date(),
      updatedAt: new Date()
    })) as SymbolDailyMetric[];

    expect(() =>
      analyzeSymbolMetrics(
        'TEST',
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
      )
    ).toThrow('Latest trade value is missing.');
  });

  it('composite action becomes PROBABLE_BUY when Stoch RSI buy exists and liquidity is not bearish', () => {
    const composite = calculateCompositeSignal(
      'EARLY_BULLISH',
      {
        shortTerm: true,
        midTerm: false,
        longTerm: false
      },
      baseSell,
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
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
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
      },
      {
        ...baseAdx,
        bearishDirectionalBias: true,
        bullishDirectionalBias: false
      },
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        riskSell: true,
        confirmedSell: true
      },
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        riskSell: true
      },
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );
    const bearish = calculateCompositeSignal(
      'BEARISH_LIQUIDITY',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
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
      },
      {
        ...baseAdx,
        bearishDirectionalBias: true,
        bullishDirectionalBias: false
      },
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        riskSell: true,
        confirmedSell: true
      },
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        riskSell: true
      },
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'IMPROVING',
        bullish: true
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
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
      baseSell,
      baseStochRsi,
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.action).toBe('HOLD');
  });

  it('downgrades STRONG_BUY when ADX is weak', () => {
    const composite = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: false
      },
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      {
        ...baseAdx,
        trendStrength: 'WEAK',
        latestAdx: 15
      },
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.action).toBe('PROBABLE_BUY');
    expect(composite.score).toBe(75);
  });

  it('high ATR downgrades strong buy and reduces score', () => {
    const composite = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: false
      },
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      baseAdx,
      {
        ...baseAtr,
        volatilityRegime: 'HIGH',
        latestAtrPercent: 0.08
      },
      neutralLiquidityConfirmation
    );

    expect(composite.action).toBe('CAUTION');
    expect(composite.score).toBe(75);
  });

  it('composite includes bias, entryTiming, and timeframe composites', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
      baseStochRsi,
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.bias).toBe('NEUTRAL');
    expect(composite.entryTiming).toBe('NOT_READY');
    expect(composite.timeframes.shortTerm).toBeDefined();
    expect(composite.timeframes.midTerm).toBeDefined();
    expect(composite.timeframes.longTerm).toBeDefined();
  });

  it('short-term score reacts strongly to Stoch RSI probableBuy', () => {
    const withoutBuy = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
      baseStochRsi,
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );
    const withBuy = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      basePriceTrend,
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(withBuy.timeframes.shortTerm.score).toBeGreaterThan(
      withoutBuy.timeframes.shortTerm.score
    );
    expect(withBuy.timeframes.shortTerm.score).toBeGreaterThanOrEqual(20);
    expect(['HOLD', 'PROBABLE_BUY']).toContain(withBuy.timeframes.shortTerm.action);
  });

  it('mid-term score reacts strongly to buy.midTerm and bullish price trend', () => {
    const composite = calculateCompositeSignal(
      'CONFIRMED_BULLISH',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: false
      },
      baseSell,
      baseStochRsi,
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      {
        ...baseAdx,
        bullishDirectionalBias: true
      },
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.timeframes.midTerm.score).toBeGreaterThanOrEqual(70);
    expect(composite.timeframes.midTerm.quality).toBe('STRONG_BULLISH');
  });

  it('long-term score reacts strongly to buy.longTerm and price above long moving average', () => {
    const composite = calculateCompositeSignal(
      'STRONG_BULLISH_LIQUIDITY',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: true
      },
      baseSell,
      baseStochRsi,
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true,
        closeAboveLongMa: true,
        midAboveLongMa: true
      },
      {
        ...baseAdx,
        bullishDirectionalBias: true
      },
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.timeframes.longTerm.score).toBeGreaterThanOrEqual(75);
    expect(composite.timeframes.longTerm.quality).toBe('STRONG_BULLISH');
  });

  it('short-term confirmedSell produces REDUCE or EXIT', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
      {
        ...baseStochRsi,
        confirmedSell: true
      },
      {
        ...basePriceTrend,
        direction: 'BEARISH',
        bearish: true,
        warning: true
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(['REDUCE', 'EXIT']).toContain(composite.timeframes.shortTerm.action);
  });

  it('long-term does not become BUY only because Stoch RSI probableBuy is true', () => {
    const composite = calculateCompositeSignal(
      'NEUTRAL',
      {
        shortTerm: false,
        midTerm: false,
        longTerm: false
      },
      baseSell,
      {
        ...baseStochRsi,
        probableBuy: true
      },
      {
        ...basePriceTrend,
        bullish: false,
        direction: 'NEUTRAL',
        closeAboveLongMa: false,
        midAboveLongMa: false
      },
      baseAdx,
      baseAtr,
      neutralLiquidityConfirmation
    );

    expect(composite.timeframes.longTerm.action).not.toBe('BUY');
  });

  it('separates short-term timing from stronger mid-term and long-term holding quality', () => {
    const composite = calculateCompositeSignal(
      'CONFIRMED_BULLISH',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: true
      },
      baseSell,
      baseStochRsi,
      {
        ...basePriceTrend,
        direction: 'BULLISH',
        bullish: true
      },
      {
        ...baseAdx,
        bullishDirectionalBias: true
      },
      baseAtr,
      {
        ...neutralLiquidityConfirmation,
        liquidityExpansion: true
      }
    );

    expect(composite.action).toBe('HOLD');
    expect(['WAIT', 'HOLD']).toContain(composite.timeframes.shortTerm.action);
    expect(composite.timeframes.midTerm.quality).toBe('STRONG_BULLISH');
    expect(composite.timeframes.midTerm.action).toBe('HOLD');
    expect(composite.timeframes.longTerm.quality).toBe('STRONG_BULLISH');
    expect(composite.timeframes.longTerm.action).toBe('HOLD');
  });
});
