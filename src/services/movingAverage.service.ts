import { round } from '../utils/number';

export const calculateSmaSeries = (
  values: number[],
  window: number
): Array<number | null> => {
  if (window <= 0) {
    throw new Error('Window must be positive.');
  }

  const result: Array<number | null> = [];

  for (let index = 0; index < values.length; index += 1) {
    if (index + 1 < window) {
      result.push(null);
      continue;
    }

    const slice = values.slice(index - window + 1, index + 1);
    const sum = slice.reduce((acc, value) => acc + value, 0);
    result.push(sum / window);
  }

  return result;
};

export const getLatestSma = (values: number[], window: number): number | null => {
  const series = calculateSmaSeries(values, window);
  return series.at(-1) ?? null;
};

export const calculateSlope = (series: Array<number | null>): number => {
  const latest = series.at(-1);
  const previous = series.at(-2);

  if (latest === null || latest === undefined || previous === null || previous === undefined) {
    return 0;
  }

  if (previous === 0) {
    return latest === 0 ? 0 : 1;
  }

  return round((latest - previous) / Math.abs(previous));
};

export const detectCrossAbove = (
  fasterSeries: Array<number | null>,
  slowerSeries: Array<number | null>
): boolean => {
  const fastLatest = fasterSeries.at(-1);
  const slowLatest = slowerSeries.at(-1);
  const fastPrev = fasterSeries.at(-2);
  const slowPrev = slowerSeries.at(-2);

  if (
    fastLatest === null ||
    fastLatest === undefined ||
    slowLatest === null ||
    slowLatest === undefined ||
    fastPrev === null ||
    fastPrev === undefined ||
    slowPrev === null ||
    slowPrev === undefined
  ) {
    return false;
  }

  return fastPrev <= slowPrev && fastLatest > slowLatest;
};

export const detectCrossBelow = (
  fasterSeries: Array<number | null>,
  slowerSeries: Array<number | null>
): boolean => {
  const fastLatest = fasterSeries.at(-1);
  const slowLatest = slowerSeries.at(-1);
  const fastPrev = fasterSeries.at(-2);
  const slowPrev = slowerSeries.at(-2);

  if (
    fastLatest === null ||
    fastLatest === undefined ||
    slowLatest === null ||
    slowLatest === undefined ||
    fastPrev === null ||
    fastPrev === undefined ||
    slowPrev === null ||
    slowPrev === undefined
  ) {
    return false;
  }

  return fastPrev >= slowPrev && fastLatest < slowLatest;
};
