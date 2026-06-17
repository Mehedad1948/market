import { describe, expect, it } from 'vitest';

import {
  buildPersianSummary,
  generateBuyTimeframePersianSummary
} from '../src/services/persianSemantic.service';

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

  it('mentions Stoch RSI and composite conclusion when provided', () => {
    const summary = buildPersianSummary(
      'فملی',
      'NEUTRAL',
      'MEDIUM',
      {
        shortTerm: true,
        midTerm: false,
        longTerm: false
      },
      {
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
      },
      {
        action: 'PROBABLE_BUY',
        score: 50,
        explanationKey: 'composite.probableBuy'
      }
    );

    expect(summary).toContain('Stoch RSI');
    expect(summary).toContain('خرید احتمالی');
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
