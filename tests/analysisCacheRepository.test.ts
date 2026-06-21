import { describe, expect, it } from 'vitest';

import { extractAnalysisCacheSummary } from '../src/repositories/analysisCache.repository';
import type { StockAnalysisResult } from '../src/types';

describe('analysisCache.repository', () => {
  it('extracts list-friendly summary fields from an analysis result', () => {
    const result = {
      metrics: {
        latestClosePrice: 1500,
        latestClosePriceChangePercent: 2.5
      },
      signals: {
        composite: {
          action: {
            value: 'PROBABLE_BUY'
          },
          score: 34,
          bias: {
            value: 'BULLISH'
          },
          entryTiming: {
            value: 'PROBABLE'
          }
        }
      }
    } as StockAnalysisResult;

    expect(extractAnalysisCacheSummary(result)).toEqual({
      action: 'PROBABLE_BUY',
      score: 34,
      bias: 'BULLISH',
      entryTiming: 'PROBABLE',
      latestClosePrice: 1500,
      latestClosePriceChangePercent: 2.5
    });
  });
});
