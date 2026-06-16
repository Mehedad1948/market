import { describe, expect, it } from 'vitest';

import {
  calculateSlope,
  calculateSmaSeries,
  detectCrossAbove,
  detectCrossBelow
} from '../src/services/movingAverage.service';

describe('movingAverage.service', () => {
  it('calculates SMA series correctly', () => {
    const result = calculateSmaSeries([10, 20, 30, 40], 2);
    expect(result).toEqual([null, 15, 25, 35]);
  });

  it('detects bullish crossover', () => {
    const fast = [null, 10, 11, 15];
    const slow = [null, 12, 12, 14];
    expect(detectCrossAbove(fast, slow)).toBe(true);
  });

  it('detects bearish crossover', () => {
    const fast = [null, 14, 13, 10];
    const slow = [null, 12, 12, 11];
    expect(detectCrossBelow(fast, slow)).toBe(true);
  });

  it('calculates normalized slope', () => {
    expect(calculateSlope([null, 100, 110])).toBe(0.1);
  });
});
