import { describe, expect, it } from 'vitest';

import { buildPersianSummary } from '../src/services/persianSemantic.service';

describe('persianSemantic.service', () => {
  it('builds semantic summary with disclaimer', () => {
    const summary = buildPersianSummary('فملی', 'NEUTRAL');
    expect(summary).toContain('فملی');
    expect(summary).toContain('توصیه خرید یا فروش');
  });
});
