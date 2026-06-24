import type { SymbolDailyMetric } from '@prisma/client';

import type {
  PriceTrendAnalysis,
  PriceTrendConfig,
  PriceTrendDirection
} from '../types';
import { sortByDateAsc } from '../utils/dateSort';
import { round } from '../utils/number';
import { calculateSlope } from './movingAverage.service';

const toNumber = (value: { toString(): string } | null): number | null => {
  return value === null ? null : Number(value.toString());
};

const emptyAnalysis = (
  latestDate: string | null,
  latestClosePrice: number | null
): PriceTrendAnalysis => {
  return {
    status: 'INSUFFICIENT_DATA',
    latestDate,
    latestClosePrice,
    fastMa: null,
    midMa: null,
    longMa: null,
    fastSlope: null,
    midSlope: null,
    longSlope: null,
    closeAboveFastMa: false,
    closeAboveMidMa: false,
    closeAboveLongMa: false,
    fastAboveMidMa: false,
    midAboveLongMa: false,
    direction: 'INSUFFICIENT_DATA',
    bullish: false,
    bearish: false,
    warning: false
  };
};

const latestNonNull = (series: Array<number | null>): number | null => {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const value = series[index] ?? null;
    if (value !== null) {
      return value;
    }
  }

  return null;
};

export const calculateSmaSeries = (
  values: Array<number | null>,
  window: number
): Array<number | null> => {
  if (window <= 0) {
    throw new Error('SMA window must be positive.');
  }

  const result = Array<number | null>(values.length).fill(null);
  const buffer: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? null;

    if (value === null) {
      continue;
    }

    buffer.push(value);
    if (buffer.length > window) {
      buffer.shift();
    }

    if (buffer.length === window) {
      result[index] = round(
        buffer.reduce((sum, item) => sum + item, 0) / window
      );
    }
  }

  return result;
};

export const calculateEmaSeries = (
  values: Array<number | null>,
  window: number
): Array<number | null> => {
  if (window <= 0) {
    throw new Error('EMA window must be positive.');
  }

  const result = Array<number | null>(values.length).fill(null);
  const warmup: number[] = [];
  const multiplier = 2 / (window + 1);
  let previousEma: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? null;

    if (value === null) {
      continue;
    }

    if (previousEma === null) {
      warmup.push(value);

      if (warmup.length === window) {
        previousEma =
          warmup.reduce((sum, item) => sum + item, 0) / warmup.length;
        result[index] = round(previousEma);
      }

      continue;
    }

    previousEma = value * multiplier + previousEma * (1 - multiplier);
    result[index] = round(previousEma);
  }

  return result;
};

const classifyPriceTrend = (
  latestClosePrice: number,
  fastMa: number,
  midMa: number,
  longMa: number,
  fastSlope: number,
  midSlope: number,
  previousFastMa: number | null,
  previousMidMa: number | null,
  minSlope: number
): PriceTrendDirection => {
  const closeAboveFastMa = latestClosePrice > fastMa;
  const fastAboveMidMa = fastMa > midMa;
  const midAboveLongMa = midMa > longMa;
  const fastBelowMidMa = fastMa < midMa;
  const midBelowLongMa = midMa < longMa;
  const gapImproving =
    previousFastMa !== null &&
    previousMidMa !== null &&
    fastMa - midMa > previousFastMa - previousMidMa;

  if (
    closeAboveFastMa &&
    fastAboveMidMa &&
    midAboveLongMa &&
    fastSlope > minSlope &&
    midSlope >= minSlope
  ) {
    return 'BULLISH';
  }

  if (
    latestClosePrice < fastMa &&
    fastBelowMidMa &&
    midBelowLongMa &&
    fastSlope < 0 &&
    midSlope <= 0
  ) {
    return 'BEARISH';
  }

  if (closeAboveFastMa && fastSlope > 0 && (fastAboveMidMa || gapImproving)) {
    return 'IMPROVING';
  }

  if (latestClosePrice < fastMa && fastSlope < 0) {
    return 'WEAKENING';
  }

  return 'NEUTRAL';
};

export const calculatePriceTrendAnalysis = (
  rows: SymbolDailyMetric[],
  config: PriceTrendConfig
): PriceTrendAnalysis => {
  const validRows = sortByDateAsc(rows)
    .map((row) => ({
      date: row.date,
      closePrice: toNumber(row.closePrice)
    }))
    .filter(
      (row): row is { date: string; closePrice: number } =>
        row.closePrice !== null
    );
  const latestRow = validRows.at(-1) ?? null;

  if (validRows.length < config.longWindow) {
    return emptyAnalysis(
      latestRow?.date ?? null,
      latestRow?.closePrice ?? null
    );
  }

  const closes = validRows.map((row) => row.closePrice);
  const calculateSeries =
    config.maType === 'EMA' ? calculateEmaSeries : calculateSmaSeries;
  const fastSeries = calculateSeries(closes, config.fastWindow);
  const midSeries = calculateSeries(closes, config.midWindow);
  const longSeries = calculateSeries(closes, config.longWindow);
  const latestClosePrice = latestRow?.closePrice ?? null;
  const fastMa = latestNonNull(fastSeries);
  const midMa = latestNonNull(midSeries);
  const longMa = latestNonNull(longSeries);

  if (
    latestRow === null ||
    latestClosePrice === null ||
    fastMa === null ||
    midMa === null ||
    longMa === null
  ) {
    return emptyAnalysis(latestRow?.date ?? null, latestClosePrice);
  }

  const fastSlope = calculateSlope(fastSeries);
  const midSlope = calculateSlope(midSeries);
  const longSlope = calculateSlope(longSeries);
  const previousFastMa = fastSeries.at(-2) ?? null;
  const previousMidMa = midSeries.at(-2) ?? null;
  const closeAboveFastMa = latestClosePrice > fastMa;
  const closeAboveMidMa = latestClosePrice > midMa;
  const closeAboveLongMa = latestClosePrice > longMa;
  const fastAboveMidMa = fastMa > midMa;
  const midAboveLongMa = midMa > longMa;
  const direction = classifyPriceTrend(
    latestClosePrice,
    fastMa,
    midMa,
    longMa,
    fastSlope,
    midSlope,
    previousFastMa,
    previousMidMa,
    config.minSlope
  );

  const warning =
    direction === 'WEAKENING' &&
    (!closeAboveMidMa || !fastAboveMidMa || !midAboveLongMa);

  return {
    status: 'OK',
    latestDate: latestRow.date,
    latestClosePrice,
    fastMa,
    midMa,
    longMa,
    fastSlope,
    midSlope,
    longSlope,
    closeAboveFastMa,
    closeAboveMidMa,
    closeAboveLongMa,
    fastAboveMidMa,
    midAboveLongMa,
    direction,
    bullish: direction === 'BULLISH' || direction === 'IMPROVING',
    bearish: direction === 'BEARISH',
    warning
  };
};
