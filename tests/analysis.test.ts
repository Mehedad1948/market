import { describe, expect, it } from 'vitest';

import { calculateConfidence, classifyRegime } from '../src/services/analysis.service';

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
});
