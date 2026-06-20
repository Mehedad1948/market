import { describe, expect, it } from 'vitest';

import { Prisma } from '@prisma/client';

import {
  isWithinMarketHours,
  isDatabaseUnavailableError,
  isHistoryStale
} from '../src/controllers/stock.controller';

describe('stock.controller history freshness', () => {
  it('treats empty history as stale', () => {
    expect(isHistoryStale([], new Date('2026-06-19T12:00:00.000Z'))).toBe(true);
  });

  it('keeps history fresh within the configured max age', () => {
    const history = [
      {
        updatedAt: new Date('2026-06-18T16:30:00.000Z')
      }
    ];

    expect(isHistoryStale(history, new Date('2026-06-19T12:00:00.000Z'))).toBe(
      false
    );
  });

  it('marks history stale after the configured max age', () => {
    const history = [
      {
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      }
    ];

    expect(isHistoryStale(history, new Date('2026-06-19T12:00:00.000Z'))).toBe(
      true
    );
  });

  it('uses the market-hours minute threshold during market hours', () => {
    const history = [
      {
        updatedAt: new Date('2026-06-19T05:35:00.000Z')
      }
    ];

    expect(isWithinMarketHours(
      new Date('2026-06-19T06:00:00.000Z'),
      'Asia/Tehran',
      '09:00',
      '12:30'
    )).toBe(true);
    expect(isHistoryStale(history, new Date('2026-06-19T06:00:00.000Z'))).toBe(
      true
    );
  });

  it('uses the hourly threshold outside market hours', () => {
    const history = [
      {
        updatedAt: new Date('2026-06-18T16:30:00.000Z')
      }
    ];

    expect(isWithinMarketHours(
      new Date('2026-06-19T12:00:00.000Z'),
      'Asia/Tehran',
      '09:00',
      '12:30'
    )).toBe(false);
    expect(isHistoryStale(history, new Date('2026-06-19T12:00:00.000Z'))).toBe(
      false
    );
  });
});

describe('stock.controller database fallback helpers', () => {
  it('recognizes Prisma database errors as database-unavailable cases', () => {
    const error = new Prisma.PrismaClientInitializationError(
      'Database init failed',
      'clientVersion'
    );

    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('does not classify generic errors as database-unavailable cases', () => {
    expect(isDatabaseUnavailableError(new Error('boom'))).toBe(false);
  });
});
