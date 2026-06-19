import { describe, expect, it } from 'vitest';

import { isHistoryStale } from '../src/controllers/stock.controller';

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
});

