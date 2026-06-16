import { describe, expect, it } from 'vitest';

import { parseNullableBigInt, parseNullableNumber } from '../src/utils/number';

describe('number utils', () => {
  it('parses safe numeric strings', () => {
    expect(parseNullableNumber('1,234.5')).toBe(1234.5);
    expect(parseNullableNumber('')).toBeNull();
  });

  it('parses bigint strings', () => {
    expect(parseNullableBigInt('123456')).toBe(123456n);
    expect(parseNullableBigInt('bad')).toBeNull();
  });
});
