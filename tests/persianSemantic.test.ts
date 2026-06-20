import { describe, expect, it } from 'vitest';

import {
  buildPersianSummary,
  generateBuyTimeframePersianSummary
} from '../src/services/persianSemantic.service';
import type {
  CompositeSignal,
  PriceTrendAnalysis,
  StochRsiAnalysis
} from '../src/types';

const stochRsiBuy: StochRsiAnalysis = {
  status: 'OK',
  latestDate: '1403-01-13',
  latestK: 15,
  latestD: 10,
  latestZone: 'GREEN',
  upperThreshold: 80,
  lowerThreshold: 20,
  crossUpInGreen: true,
  crossDownInRed: false,
  redBearishCrossCount: 0,
  greenBullishCrossCount: 1,
  barsSinceLastGreenCrossUp: 1,
  barsSinceLastRedCrossDown: null,
  probableBuy: true,
  riskSell: false,
  confirmedSell: false
};

const bullishPriceTrend: PriceTrendAnalysis = {
  status: 'OK',
  latestDate: '1403-01-13',
  latestClosePrice: 575,
  fastMa: 540.2,
  midMa: 498.7,
  longMa: 421.3,
  fastSlope: 0.03,
  midSlope: 0.01,
  longSlope: 0.004,
  closeAboveFastMa: true,
  closeAboveMidMa: true,
  closeAboveLongMa: true,
  fastAboveMidMa: true,
  midAboveLongMa: true,
  direction: 'BULLISH',
  bullish: true,
  bearish: false,
  warning: false
};

const probableBuyComposite: CompositeSignal = {
  action: 'PROBABLE_BUY',
  score: 50,
  bias: 'BULLISH',
  entryTiming: 'PROBABLE',
  explanationKey: 'composite.probableBuy',
  scoreScale: {
    min: -100,
    max: 100
  },
  timeframes: {
    shortTerm: {
      score: 40,
      action: 'PROBABLE_BUY',
      quality: 'BULLISH',
      explanationKey: 'timeframe.short.probableBuy'
    },
    midTerm: {
      score: 55,
      action: 'HOLD',
      quality: 'BULLISH',
      explanationKey: 'timeframe.mid.hold'
    },
    longTerm: {
      score: 75,
      action: 'HOLD',
      quality: 'STRONG_BULLISH',
      explanationKey: 'timeframe.long.hold'
    }
  }
};

describe('persianSemantic.service', () => {
  it('builds semantic summary with disclaimer', () => {
    const summary = buildPersianSummary('فملی', 'NEUTRAL');
    expect(summary).toContain('فملی');
    expect(summary).toContain('توصیه خرید یا فروش');
  });

  it('mentions active buy conditions when present', () => {
    const summary = buildPersianSummary('فملی', 'NEUTRAL', 'MEDIUM', {
      shortTerm: true,
      midTerm: false,
      longTerm: true
    });

    expect(summary).toContain('کوتاه‌مدت');
    expect(summary).toContain('بلندمدت');
    expect(summary).toContain('توصیه خرید یا فروش');
  });

  it('includes liquidity, Stoch RSI, price trend, composite action, and disclaimer', () => {
    const summary = buildPersianSummary(
      'فملی',
      'NEUTRAL',
      'MEDIUM',
      {
        shortTerm: true,
        midTerm: false,
        longTerm: false
      },
      stochRsiBuy,
      probableBuyComposite,
      bullishPriceTrend
    );

    expect(summary).toContain('وضعیت ارزش معاملات');
    expect(summary).toContain('Stoch RSI');
    expect(summary).toContain('روند قیمت نیز صعودی');
    expect(summary).toContain('خرید احتمالی');
    expect(summary).toContain('توصیه خرید یا فروش');
  });

  it('explains confirmed sell while main trend is still strong as caution', () => {
    const summary = buildPersianSummary(
      'فملی',
      'STRONG_BULLISH_LIQUIDITY',
      'HIGH',
      {
        shortTerm: true,
        midTerm: true,
        longTerm: true
      },
      {
        ...stochRsiBuy,
        probableBuy: false,
        riskSell: true,
        confirmedSell: true
      },
      {
        action: 'CAUTION',
        score: 10,
        bias: 'NEUTRAL',
        entryTiming: 'RISKY',
        explanationKey: 'composite.confirmedSellButTrendStrong',
        scoreScale: {
          min: -100,
          max: 100
        },
        timeframes: {
          shortTerm: {
            score: -40,
            action: 'REDUCE',
            quality: 'BEARISH',
            explanationKey: 'timeframe.short.reduceConfirmedSell'
          },
          midTerm: {
            score: 35,
            action: 'CAUTION',
            quality: 'BULLISH',
            explanationKey: 'timeframe.mid.caution'
          },
          longTerm: {
            score: 55,
            action: 'HOLD',
            quality: 'BULLISH',
            explanationKey: 'timeframe.long.hold'
          }
        }
      },
      bullishPriceTrend
    );

    expect(summary).toContain('نه الزاماً خروج کامل');
  });

  it.skip('adds concise short, mid, and long horizon interpretations', () => {
    const summary = buildPersianSummary(
      'ÙÙ…Ù„ÛŒ',
      'NEUTRAL',
      'MEDIUM',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: true
      },
      stochRsiBuy,
      probableBuyComposite,
      bullishPriceTrend
    );

    expect(summary).toContain('Ø¬Ù…Ø¹â€ŒØ¨Ù†Ø¯ÛŒ Ú©ÙˆØªØ§Ù‡â€ŒÙ…Ø¯Øª');
    expect(summary).toContain('Ø¬Ù…Ø¹â€ŒØ¨Ù†Ø¯ÛŒ Ù…ÛŒØ§Ù†â€ŒÙ…Ø¯Øª');
    expect(summary).toContain('Ø¬Ù…Ø¹â€ŒØ¨Ù†Ø¯ÛŒ Ø¨Ù„Ù†Ø¯Ù…Ø¯Øª');
  });

  it('returns a fallback sentence when no buy conditions are active', () => {
    const summary = generateBuyTimeframePersianSummary({
      shortTerm: false,
      midTerm: false,
      longTerm: false
    });

    expect(summary).toContain('هیچ‌کدام از شروط خرید');
  });
});
