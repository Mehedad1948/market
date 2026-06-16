export const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const sanitized = value.replace(/,/g, '').trim();
    if (!sanitized) {
      return null;
    }

    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parseNullableBigInt = (value: unknown): bigint | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === 'string') {
    const sanitized = value.replace(/,/g, '').trim();
    if (!sanitized) {
      return null;
    }

    try {
      return BigInt(sanitized);
    } catch {
      return null;
    }
  }

  return null;
};

export const round = (value: number, precision = 6): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};
