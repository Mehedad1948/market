import type { SymbolDailyMetric } from '@prisma/client';

import type {
  StochRsiAnalysis,
  StochRsiConfig,
  StochRsiPoint,
  StochRsiZone
} from '../types';
import { sortByDateAsc } from '../utils/dateSort';
import { round } from '../utils/number';

const toNumber = (value: { toString(): string } | null): number | null => {
  return value === null ? null : Number(value.toString());
};

const getZone = (
  k: number | null,
  d: number | null,
  upperThreshold: number,
  lowerThreshold: number
): StochRsiZone => {
  if (k === null || d === null) {
    return 'UNKNOWN';
  }

  if (Math.max(k, d) >= upperThreshold) {
    return 'RED';
  }

  if (Math.min(k, d) <= lowerThreshold) {
    return 'GREEN';
  }

  return 'NEUTRAL';
};

const findLastIndex = <T>(
  items: T[],
  predicate: (item: T) => boolean
): number => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) {
      return index;
    }
  }

  return -1;
};

export const calculateRsiSeries = (
  closes: Array<number | null>,
  length: number
): Array<number | null> => {
  if (length <= 0) {
    throw new Error('RSI length must be positive.');
  }

  const result = Array<number | null>(closes.length).fill(null);
  let previousClose: number | null = null;
  let gainSum = 0;
  let lossSum = 0;
  let deltaCount = 0;
  let avgGain: number | null = null;
  let avgLoss: number | null = null;

  for (let index = 0; index < closes.length; index += 1) {
    const close = closes[index] ?? null;

    if (close === null) {
      continue;
    }

    if (previousClose === null) {
      previousClose = close;
      continue;
    }

    const change = close - previousClose;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (avgGain === null || avgLoss === null) {
      gainSum += gain;
      lossSum += loss;
      deltaCount += 1;

      if (deltaCount === length) {
        avgGain = gainSum / length;
        avgLoss = lossSum / length;
      }
    } else {
      avgGain = (avgGain * (length - 1) + gain) / length;
      avgLoss = (avgLoss * (length - 1) + loss) / length;
    }

    if (avgGain !== null && avgLoss !== null) {
      if (avgLoss === 0) {
        result[index] = 100;
      } else if (avgGain === 0) {
        result[index] = 0;
      } else {
        const rs = avgGain / avgLoss;
        result[index] = round(100 - 100 / (1 + rs));
      }
    }

    previousClose = close;
  }

  return result;
};

export const calculateStochRsiSeries = (
  rsiSeries: Array<number | null>,
  stochLength: number
): Array<number | null> => {
  if (stochLength <= 0) {
    throw new Error('Stoch RSI length must be positive.');
  }

  const result = Array<number | null>(rsiSeries.length).fill(null);
  const buffer: number[] = [];

  for (let index = 0; index < rsiSeries.length; index += 1) {
    const rsi = rsiSeries[index] ?? null;

    if (rsi === null) {
      continue;
    }

    buffer.push(rsi);
    if (buffer.length > stochLength) {
      buffer.shift();
    }

    if (buffer.length < stochLength) {
      continue;
    }

    const lowestRsi = Math.min(...buffer);
    const highestRsi = Math.max(...buffer);
    const denominator = highestRsi - lowestRsi;

    result[index] =
      denominator === 0 ? null : round((100 * (rsi - lowestRsi)) / denominator);
  }

  return result;
};

export const smoothSma = (
  series: Array<number | null>,
  length: number
): Array<number | null> => {
  if (length <= 0) {
    throw new Error('Smoothing length must be positive.');
  }

  const result = Array<number | null>(series.length).fill(null);
  const buffer: number[] = [];

  for (let index = 0; index < series.length; index += 1) {
    const value = series[index] ?? null;

    if (value === null) {
      continue;
    }

    buffer.push(value);
    if (buffer.length > length) {
      buffer.shift();
    }

    if (buffer.length < length) {
      continue;
    }

    const sum = buffer.reduce((acc, item) => acc + item, 0);
    result[index] = round(sum / length);
  }

  return result;
};

export const buildStochRsiPoints = (
  rows: SymbolDailyMetric[],
  config: StochRsiConfig
): StochRsiPoint[] => {
  const sortedRows = sortByDateAsc(rows);
  const closes = sortedRows.map((row) => toNumber(row.closePrice));
  const rsiSeries = calculateRsiSeries(closes, config.rsiLength);
  const stochRsiSeries = calculateStochRsiSeries(rsiSeries, config.stochLength);
  const kSeries = smoothSma(stochRsiSeries, config.kSmooth);
  const dSeries = smoothSma(kSeries, config.dSmooth);

  return sortedRows.map((row, index) => {
    const currentK = kSeries[index] ?? null;
    const currentD = dSeries[index] ?? null;
    const previousK = index > 0 ? (kSeries[index - 1] ?? null) : null;
    const previousD = index > 0 ? (dSeries[index - 1] ?? null) : null;
    const isCrossComparable =
      previousK !== null &&
      previousD !== null &&
      currentK !== null &&
      currentD !== null &&
      Math.abs(currentK - currentD) >= config.minCrossDistance;
    const crossUp =
      isCrossComparable && previousK <= previousD && currentK > currentD
        ? true
        : false;
    const crossDown =
      isCrossComparable && previousK >= previousD && currentK < currentD
        ? true
        : false;
    const crossUpInGreen =
      crossUp &&
      Math.min(previousK!, previousD!, currentK!, currentD!) <= config.lower;
    const crossDownInRed =
      crossDown &&
      Math.max(previousK!, previousD!, currentK!, currentD!) >= config.upper;

    return {
      date: row.date,
      rsi: rsiSeries[index] ?? null,
      stochRsi: stochRsiSeries[index] ?? null,
      k: currentK,
      d: currentD,
      zone: getZone(currentK, currentD, config.upper, config.lower),
      crossUp,
      crossDown,
      crossUpInGreen,
      crossDownInRed
    };
  });
};

export const calculateStochRsiAnalysis = (
  rows: SymbolDailyMetric[],
  config: StochRsiConfig
): StochRsiAnalysis => {
  const points = buildStochRsiPoints(rows, config);
  const latestPoint = points.at(-1) ?? null;
  const validSignalPoints = points.filter(
    (point) => point.k !== null && point.d !== null
  );
  const status: StochRsiAnalysis['status'] =
    validSignalPoints.length > 0 ? 'OK' : 'INSUFFICIENT_DATA';
  const latestIndex = points.length - 1;
  const lastGreenCrossIndex = findLastIndex(
    points,
    (point) => point.crossUpInGreen
  );
  const lastRedCrossIndex = findLastIndex(
    points,
    (point) => point.crossDownInRed
  );
  const barsSinceLastGreenCrossUp =
    lastGreenCrossIndex === -1 ? null : latestIndex - lastGreenCrossIndex;
  const barsSinceLastRedCrossDown =
    lastRedCrossIndex === -1 ? null : latestIndex - lastRedCrossIndex;
  const recentSellSlice =
    config.sellLookback > 0
      ? points.slice(-config.sellLookback)
      : ([] as StochRsiPoint[]);
  const recentBuySlice =
    config.buyLookback > 0
      ? points.slice(-config.buyLookback)
      : ([] as StochRsiPoint[]);
  const redBearishCrossCount = recentSellSlice.filter(
    (point) => point.crossDownInRed
  ).length;
  const greenBullishCrossCount = recentBuySlice.filter(
    (point) => point.crossUpInGreen
  ).length;
  const recentGreenCross =
    barsSinceLastGreenCrossUp !== null &&
    barsSinceLastGreenCrossUp <= config.signalMaxAge;
  const recentRedCross =
    barsSinceLastRedCrossDown !== null &&
    barsSinceLastRedCrossDown <= config.signalMaxAge;
  const latestK = latestPoint?.k ?? null;
  const latestD = latestPoint?.d ?? null;
  const probableBuy =
    barsSinceLastGreenCrossUp !== null &&
    barsSinceLastGreenCrossUp <= config.buyLookback &&
    ((latestK !== null && latestD !== null && latestK > latestD) ||
      recentGreenCross);
  const riskSell = redBearishCrossCount >= 2;
  const confirmedSell =
    riskSell &&
    recentRedCross &&
    latestK !== null &&
    latestD !== null &&
    latestK < latestD;

  return {
    status,
    latestDate: latestPoint?.date ?? null,
    latestK,
    latestD,
    latestZone: latestPoint?.zone ?? 'UNKNOWN',
    upperThreshold: config.upper,
    lowerThreshold: config.lower,
    crossUpInGreen: recentGreenCross,
    crossDownInRed: recentRedCross,
    redBearishCrossCount,
    greenBullishCrossCount,
    barsSinceLastGreenCrossUp,
    barsSinceLastRedCrossDown,
    probableBuy,
    riskSell,
    confirmedSell
  };
};
