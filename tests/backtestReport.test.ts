import { describe, expect, it } from 'vitest';

import {
  buildBacktestReport,
  type BacktestSnapshotLike
} from '../src/services/backtest.service';

const snapshot = (
  overrides: Partial<BacktestSnapshotLike>
): BacktestSnapshotLike =>
  ({
    symbol: 'TEST',
    asOfDate: '1403-01-01',
    sectorName: 'Metals',
    compositeAction: 'PROBABLE_BUY',
    compositeScore: 45,
    compositeBias: 'BULLISH',
    compositeEntryTiming: 'PROBABLE',
    shortAction: 'PROBABLE_BUY',
    shortScore: 45,
    shortQuality: 'BULLISH',
    shortForNewPosition: 'PROBABLE_BUY',
    shortForExistingPosition: 'HOLD',
    midAction: 'HOLD',
    midScore: 25,
    midQuality: 'BULLISH',
    midForNewPosition: 'WAIT_FOR_ENTRY_TRIGGER',
    midForExistingPosition: 'HOLD',
    longAction: 'HOLD',
    longScore: 30,
    longQuality: 'BULLISH',
    longForNewPosition: 'WAIT_FOR_ENTRY_TRIGGER',
    longForExistingPosition: 'HOLD',
    atrVolatilityRegime: 'NORMAL',
    liquidityBucket: 'NORMAL',
    forwardReturn1d: 0.02,
    forwardReturn5d: 0.05,
    forwardReturn20d: 0.1,
    forwardReturn60d: 0.2,
    maxDrawdown1d: -0.01,
    maxDrawdown5d: -0.03,
    maxDrawdown20d: -0.04,
    maxDrawdown60d: -0.08,
    ...overrides
  }) as BacktestSnapshotLike;

describe('buildBacktestReport', () => {
  it('aggregates global and timeframe report domains across all horizons', () => {
    const report = buildBacktestReport([
      snapshot({ symbol: 'AAA', compositeAction: 'PROBABLE_BUY' }),
      snapshot({
        symbol: 'BBB',
        sectorName: 'Auto',
        compositeAction: 'RISK_SELL',
        compositeScore: -45,
        compositeBias: 'BEARISH',
        compositeEntryTiming: 'RISKY',
        shortAction: 'REDUCE',
        shortScore: -45,
        shortQuality: 'BEARISH',
        shortForNewPosition: 'AVOID',
        shortForExistingPosition: 'REDUCE',
        liquidityBucket: 'CONTRACTION',
        atrVolatilityRegime: 'HIGH',
        forwardReturn1d: -0.01,
        forwardReturn5d: -0.04,
        forwardReturn20d: -0.08,
        forwardReturn60d: -0.12,
        maxDrawdown1d: -0.03,
        maxDrawdown5d: -0.07,
        maxDrawdown20d: -0.12,
        maxDrawdown60d: -0.2
      })
    ]);

    expect(report.sampleCount).toBe(2);
    expect(report.global.overall.horizons['5d']).toMatchObject({
      sampleCount: 2,
      avgReturn: 0.005,
      winRate: 0.5,
      negativeReturnRate: 0.5,
      worstDrawdown: -0.07
    });
    expect(report.global.byCompositeAction.map((group) => group.key)).toContain(
      'RISK_SELL'
    );
    expect(report.timeframes.midTerm.byForExistingPosition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'HOLD',
          sampleCount: 2
        })
      ])
    );
    expect(report.timeframes).not.toHaveProperty('shortTerm');
    expect(report.diagnostics.drawdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon: '60d'
        })
      ])
    );
  });

  it('returns custom groups when groupBy is requested', () => {
    const report = buildBacktestReport(
      [
        snapshot({ symbol: 'AAA', liquidityBucket: 'EXPANSION' }),
        snapshot({ symbol: 'BBB', liquidityBucket: 'CONTRACTION' })
      ],
      'liquidityBucket'
    );

    expect(report.customGroups?.map((group) => group.key).sort()).toEqual([
      'CONTRACTION',
      'EXPANSION'
    ]);
  });
});
