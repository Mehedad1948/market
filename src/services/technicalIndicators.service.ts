import type { SymbolDailyMetric } from '@prisma/client';

import type { AdxAnalysis, AtrAnalysis, MfiAnalysis } from '../types';
import { sortByDateAsc } from '../utils/dateSort';
import { round } from '../utils/number';

const toNumber = (value: { toString(): string } | null): number | null => {
  return value === null ? null : Number(value.toString());
};

type OhlcRow = {
  date: string;
  high: number;
  low: number;
  close: number;
};

const toValidOhlcRows = (rows: SymbolDailyMetric[]): OhlcRow[] => {
  return sortByDateAsc(rows)
    .map((row) => ({
      date: row.date,
      high: toNumber(row.priceMax),
      low: toNumber(row.priceMin),
      close: toNumber(row.closePrice)
    }))
    .filter(
      (row): row is OhlcRow =>
        row.high !== null && row.low !== null && row.close !== null
    );
};

const classifyAtrRegime = (
  latestAtrPercent: number | null,
  lowThreshold: number,
  highThreshold: number
): AtrAnalysis['volatilityRegime'] => {
  if (latestAtrPercent === null) {
    return 'INSUFFICIENT_DATA';
  }

  if (latestAtrPercent < lowThreshold) {
    return 'LOW';
  }

  if (latestAtrPercent > highThreshold) {
    return 'HIGH';
  }

  return 'NORMAL';
};

const buildInsufficientAtr = (period: number): AtrAnalysis => {
  return {
    status: 'INSUFFICIENT_DATA',
    period,
    latestAtr: null,
    latestAtrPercent: null,
    volatilityRegime: 'INSUFFICIENT_DATA'
  };
};

export const calculateAtrAnalysis = (
  rows: SymbolDailyMetric[],
  period = 14,
  lowThreshold = 0.015,
  highThreshold = 0.05
): AtrAnalysis => {
  const validRows = toValidOhlcRows(rows);

  if (period <= 0 || validRows.length < period + 1) {
    return buildInsufficientAtr(period);
  }

  const trueRanges: number[] = [];

  for (let index = 1; index < validRows.length; index += 1) {
    const current = validRows[index];
    const previous = validRows[index - 1];

    if (!current || !previous) {
      continue;
    }

    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    trueRanges.push(trueRange);
  }

  if (trueRanges.length < period) {
    return buildInsufficientAtr(period);
  }

  let atr =
    trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let index = period; index < trueRanges.length; index += 1) {
    const trueRange = trueRanges[index];
    if (trueRange === undefined) {
      continue;
    }

    atr = (atr * (period - 1) + trueRange) / period;
  }

  const latestClose = validRows.at(-1)?.close ?? null;
  const latestAtr = round(atr);
  const latestAtrPercent =
    latestClose !== null && latestClose !== 0 ? round(latestAtr / latestClose) : null;

  return {
    status: 'OK',
    period,
    latestAtr,
    latestAtrPercent,
    volatilityRegime: classifyAtrRegime(
      latestAtrPercent,
      lowThreshold,
      highThreshold
    )
  };
};

const classifyAdxStrength = (latestAdx: number | null): AdxAnalysis['trendStrength'] => {
  if (latestAdx === null) {
    return 'INSUFFICIENT_DATA';
  }

  if (latestAdx < 20) {
    return 'WEAK';
  }

  if (latestAdx < 25) {
    return 'MODERATE';
  }

  return 'STRONG';
};

const buildInsufficientAdx = (period: number): AdxAnalysis => {
  return {
    status: 'INSUFFICIENT_DATA',
    period,
    latestAdx: null,
    latestPlusDi: null,
    latestMinusDi: null,
    trendStrength: 'INSUFFICIENT_DATA',
    bullishDirectionalBias: false,
    bearishDirectionalBias: false
  };
};

export const calculateAdxAnalysis = (
  rows: SymbolDailyMetric[],
  period = 14
): AdxAnalysis => {
  const validRows = toValidOhlcRows(rows);

  if (period <= 0 || validRows.length < period * 2) {
    return buildInsufficientAdx(period);
  }

  const trList: number[] = [];
  const plusDmList: number[] = [];
  const minusDmList: number[] = [];

  for (let index = 1; index < validRows.length; index += 1) {
    const current = validRows[index];
    const previous = validRows[index - 1];

    if (!current || !previous) {
      continue;
    }

    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    trList.push(trueRange);
    plusDmList.push(plusDm);
    minusDmList.push(minusDm);
  }

  if (trList.length < period * 2 - 1) {
    return buildInsufficientAdx(period);
  }

  let smoothedTr = trList.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedPlusDm = plusDmList
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0);
  let smoothedMinusDm = minusDmList
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0);
  const dxValues: number[] = [];
  let latestPlusDi: number | null = null;
  let latestMinusDi: number | null = null;

  for (let index = period - 1; index < trList.length; index += 1) {
    if (index > period - 1) {
      const tr = trList[index];
      const plusDm = plusDmList[index];
      const minusDm = minusDmList[index];

      if (tr === undefined || plusDm === undefined || minusDm === undefined) {
        continue;
      }

      smoothedTr = smoothedTr - smoothedTr / period + tr;
      smoothedPlusDm = smoothedPlusDm - smoothedPlusDm / period + plusDm;
      smoothedMinusDm = smoothedMinusDm - smoothedMinusDm / period + minusDm;
    }

    if (smoothedTr === 0) {
      dxValues.push(0);
      latestPlusDi = 0;
      latestMinusDi = 0;
      continue;
    }

    const plusDi = (100 * smoothedPlusDm) / smoothedTr;
    const minusDi = (100 * smoothedMinusDm) / smoothedTr;
    const denominator = plusDi + minusDi;
    const dx = denominator === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / denominator;

    dxValues.push(dx);
    latestPlusDi = round(plusDi);
    latestMinusDi = round(minusDi);
  }

  if (dxValues.length < period) {
    return buildInsufficientAdx(period);
  }

  let adx = dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let index = period; index < dxValues.length; index += 1) {
    const dx = dxValues[index];
    if (dx === undefined) {
      continue;
    }

    adx = (adx * (period - 1) + dx) / period;
  }

  const latestAdx = round(adx);

  return {
    status: 'OK',
    period,
    latestAdx,
    latestPlusDi,
    latestMinusDi,
    trendStrength: classifyAdxStrength(latestAdx),
    bullishDirectionalBias:
      latestPlusDi !== null &&
      latestMinusDi !== null &&
      latestPlusDi > latestMinusDi,
    bearishDirectionalBias:
      latestPlusDi !== null &&
      latestMinusDi !== null &&
      latestMinusDi > latestPlusDi
  };
};

type OhlcvRow = OhlcRow & {
  tradeValue: number;
};

const toValidOhlcvRows = (rows: SymbolDailyMetric[]): OhlcvRow[] => {
  return sortByDateAsc(rows)
    .map((row) => ({
      date: row.date,
      high: toNumber(row.priceMax),
      low: toNumber(row.priceMin),
      close: toNumber(row.closePrice),
      tradeValue: toNumber(row.tradeValue)
    }))
    .filter(
      (row): row is OhlcvRow =>
        row.high !== null &&
        row.low !== null &&
        row.close !== null &&
        row.tradeValue !== null &&
        row.tradeValue > 0
    );
};

const buildInsufficientMfi = (
  period: number,
  upperThreshold: number,
  lowerThreshold: number
): MfiAnalysis => {
  return {
    status: 'INSUFFICIENT_DATA',
    period,
    latestMfi: null,
    previousMfi: null,
    upperThreshold,
    lowerThreshold,
    direction: 'INSUFFICIENT_DATA',
    overbought: false,
    oversold: false,
    bullishConfirmation: false,
    bearishConfirmation: false,
    accumulation: false,
    distribution: false
  };
};

export const calculateMfiAnalysis = (
  rows: SymbolDailyMetric[],
  period = 14,
  lowerThreshold = 20,
  upperThreshold = 80
): MfiAnalysis => {
  const validRows = toValidOhlcvRows(rows);

  if (period <= 0 || validRows.length < period + 1) {
    return buildInsufficientMfi(period, upperThreshold, lowerThreshold);
  }

  const moneyFlowSeries = validRows.map((row) => ({
    typicalPrice: (row.high + row.low + row.close) / 3,
    moneyFlow: row.tradeValue
  }));
  const mfiSeries: number[] = [];

  for (let index = period; index < moneyFlowSeries.length; index += 1) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let lookbackIndex = index - period + 1; lookbackIndex <= index; lookbackIndex += 1) {
      const current = moneyFlowSeries[lookbackIndex];
      const previous = moneyFlowSeries[lookbackIndex - 1];

      if (!current || !previous) {
        continue;
      }

      if (current.typicalPrice > previous.typicalPrice) {
        positiveFlow += current.moneyFlow;
      } else if (current.typicalPrice < previous.typicalPrice) {
        negativeFlow += current.moneyFlow;
      }
    }

    const mfi =
      negativeFlow === 0
        ? 100
        : 100 - 100 / (1 + positiveFlow / negativeFlow);
    mfiSeries.push(round(mfi));
  }

  const latestMfi = mfiSeries.at(-1) ?? null;
  const previousMfi = mfiSeries.at(-2) ?? null;

  if (latestMfi === null) {
    return buildInsufficientMfi(period, upperThreshold, lowerThreshold);
  }

  const direction =
    previousMfi === null
      ? 'FLAT'
      : latestMfi > previousMfi
        ? 'RISING'
        : latestMfi < previousMfi
          ? 'FALLING'
          : 'FLAT';
  const overbought = latestMfi >= upperThreshold;
  const oversold = latestMfi <= lowerThreshold;
  const bullishConfirmation =
    latestMfi >= 50 &&
    direction === 'RISING' &&
    !overbought;
  const bearishConfirmation =
    latestMfi < 50 &&
    direction === 'FALLING' &&
    !oversold;
  const accumulation =
    latestMfi >= 55 &&
    latestMfi < upperThreshold &&
    direction === 'RISING';
  const distribution =
    latestMfi <= 45 &&
    direction === 'FALLING';

  return {
    status: 'OK',
    period,
    latestMfi,
    previousMfi,
    upperThreshold,
    lowerThreshold,
    direction,
    overbought,
    oversold,
    bullishConfirmation,
    bearishConfirmation,
    accumulation,
    distribution
  };
};
