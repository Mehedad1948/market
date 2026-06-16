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

  it('returns a fallback sentence when no buy conditions are active', () => {
    const summary = generateBuyTimeframePersianSummary({
      shortTerm: false,
      midTerm: false,
      longTerm: false
    });

    expect(summary).toContain('هیچ‌کدام از شروط خرید');
  });
});
