import { describe, expect, it } from 'vitest';

import { buildPersianSummary } from '../src/services/persianSemantic.service';
import type { CompositeSignal, PriceTrendAnalysis, StochRsiAnalysis } from '../src/types';

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

const composite: CompositeSignal = {
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

describe('persian horizon summary', () => {
  it('includes short, mid, and long horizon interpretation sentences', () => {
    const summary = buildPersianSummary(
      'FMLI',
      'NEUTRAL',
      'MEDIUM',
      {
        shortTerm: false,
        midTerm: true,
        longTerm: true
      },
      stochRsiBuy,
      composite,
      bullishPriceTrend
    );

    expect(summary).toContain(
      '\u062c\u0645\u0639\u200c\u0628\u0646\u062f\u06cc \u06a9\u0648\u062a\u0627\u0647\u200c\u0645\u062f\u062a'
    );
    expect(summary).toContain(
      '\u062c\u0645\u0639\u200c\u0628\u0646\u062f\u06cc \u0645\u06cc\u0627\u0646\u200c\u0645\u062f\u062a'
    );
    expect(summary).toContain(
      '\u062c\u0645\u0639\u200c\u0628\u0646\u062f\u06cc \u0628\u0644\u0646\u062f\u0645\u062f\u062a'
    );
  });
});
