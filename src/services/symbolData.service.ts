import type { Prisma, SymbolDailyMetric } from '@prisma/client';

import { brsClient } from './brsClient';
import { logger } from '../lib/logger';
import { symbolRepository } from '../repositories/symbol.repository';
import type { BrsHistoryTradeRow, BrsRealLegalRow } from '../types';
import { parseNullableBigInt, parseNullableNumber } from '../utils/number';

const normalizeTradeRow = (
  symbol: string,
  row: BrsHistoryTradeRow
): Prisma.SymbolDailyMetricUncheckedCreateInput | null => {
  if (!row.date) {
    return null;
  }

  return {
    symbol,
    date: String(row.date),
    time: row.time ? String(row.time) : null,
    tradeCount: parseNullableBigInt(row.tno) ?? null,
    tradeVolume: parseNullableNumber(row.tvol) ?? null,
    tradeValue: parseNullableNumber(row.tval) ?? null,
    priceMin: parseNullableNumber(row.pmin) ?? null,
    priceMax: parseNullableNumber(row.pmax) ?? null,
    priceYesterday: parseNullableNumber(row.py) ?? null,
    priceFirst: parseNullableNumber(row.pf) ?? null,
    priceLast: parseNullableNumber(row.pl) ?? null,
    priceLastChange: parseNullableNumber(row.plc) ?? null,
    priceLastChangePercent: parseNullableNumber(row.plp) ?? null,
    closePrice: parseNullableNumber(row.pc) ?? null,
    closePriceChange: parseNullableNumber(row.pcc) ?? null,
    closePriceChangePercent: parseNullableNumber(row.pcp) ?? null,
    rawJson: row as Prisma.InputJsonValue
  };
};

const normalizeRealLegalRow = (
  symbol: string,
  row: BrsRealLegalRow
): Prisma.SymbolRealLegalDailyUncheckedCreateInput | null => {
  if (!row.date) {
    return null;
  }

  return {
    symbol,
    date: String(row.date),
    buyCountIndividual: parseNullableBigInt(row.Buy_CountI) ?? null,
    buyCountLegal: parseNullableBigInt(row.Buy_CountN) ?? null,
    sellCountIndividual: parseNullableBigInt(row.Sell_CountI) ?? null,
    sellCountLegal: parseNullableBigInt(row.Sell_CountN) ?? null,
    buyVolumeIndividual: parseNullableNumber(row.Buy_I_Volume) ?? null,
    buyVolumeLegal: parseNullableNumber(row.Buy_N_Volume) ?? null,
    sellVolumeIndividual: parseNullableNumber(row.Sell_I_Volume) ?? null,
    sellVolumeLegal: parseNullableNumber(row.Sell_N_Volume) ?? null,
    buyValueIndividual: parseNullableNumber(row.Buy_I_Value) ?? null,
    sellValueIndividual: parseNullableNumber(row.Sell_I_Value) ?? null,
    rawJson: row as Prisma.InputJsonValue
  };
};

const buildTransientMetricRow = (
  row: Prisma.SymbolDailyMetricUncheckedCreateInput,
  index: number
): SymbolDailyMetric => {
  const now = new Date();

  return {
    id: `brs-${row.symbol}-${row.date}-${index}`,
    symbol: row.symbol,
    date: row.date,
    time: row.time ?? null,
    tradeCount: row.tradeCount ?? null,
    tradeVolume: row.tradeVolume ?? null,
    tradeValue: row.tradeValue ?? null,
    priceMin: row.priceMin ?? null,
    priceMax: row.priceMax ?? null,
    priceYesterday: row.priceYesterday ?? null,
    priceFirst: row.priceFirst ?? null,
    priceLast: row.priceLast ?? null,
    priceLastChange: row.priceLastChange ?? null,
    priceLastChangePercent: row.priceLastChangePercent ?? null,
    closePrice: row.closePrice ?? null,
    closePriceChange: row.closePriceChange ?? null,
    closePriceChangePercent: row.closePriceChangePercent ?? null,
    rawJson: row.rawJson as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now
  } as unknown as SymbolDailyMetric;
};

export const symbolDataService = {
  async fetchSymbolHistoryFromBrs(
    symbol: string,
    includeRealLegal: boolean
  ): Promise<SymbolDailyMetric[]> {
    logger.info(
      { symbol, includeRealLegal },
      '📥 Fetching symbol history from BrsApi'
    );
    const tradeHistory = await brsClient.fetchTradeHistory(symbol);
    const normalizedTradeRows = tradeHistory
      .map((row) => normalizeTradeRow(symbol, row))
      .filter(
        (row): row is Prisma.SymbolDailyMetricUncheckedCreateInput =>
          row !== null
      );

    void includeRealLegal;

    logger.info(
      {
        symbol,
        includeRealLegal,
        fetchedTradeRows: tradeHistory.length,
        normalizedTradeRows: normalizedTradeRows.length
      },
      normalizedTradeRows.length > 0
        ? '✅ Symbol history normalized'
        : '⚠️ Symbol history fetch produced no storable trade rows'
    );

    return normalizedTradeRows.map((row, index) =>
      buildTransientMetricRow(row, index)
    );
  },

  async refreshSymbolHistory(symbol: string, includeRealLegal: boolean) {
    const startedAt = Date.now();
    logger.info(
      { symbol, includeRealLegal },
      '🔄 Refreshing symbol history'
    );
    await symbolRepository.upsertSymbol(symbol);
    logger.info(
      { symbol, durationMs: Date.now() - startedAt },
      '🧩 Symbol row ensured before history persistence'
    );

    const transientRows = await this.fetchSymbolHistoryFromBrs(
      symbol,
      includeRealLegal
    );
    const normalizedTradeRows = transientRows.map((row) => ({
      symbol: row.symbol,
      date: row.date,
      time: row.time,
      tradeCount: row.tradeCount,
      tradeVolume: row.tradeVolume,
      tradeValue: row.tradeValue,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      priceYesterday: row.priceYesterday,
      priceFirst: row.priceFirst,
      priceLast: row.priceLast,
      priceLastChange: row.priceLastChange,
      priceLastChangePercent: row.priceLastChangePercent,
      closePrice: row.closePrice,
      closePriceChange: row.closePriceChange,
      closePriceChangePercent: row.closePriceChangePercent,
      rawJson: row.rawJson as Prisma.InputJsonValue
    }));

    const dailyMetricsStartedAt = Date.now();
    logger.info(
      {
        symbol,
        includeRealLegal,
        tradeRowsToPersist: normalizedTradeRows.length
      },
      '💽 Persisting trade history to database'
    );
    await symbolRepository.upsertDailyMetrics(normalizedTradeRows);
    logger.info(
      {
        symbol,
        includeRealLegal,
        tradeRowsUpserted: normalizedTradeRows.length,
        durationMs: Date.now() - dailyMetricsStartedAt
      },
      '💾 Trade history persisted'
    );

    if (includeRealLegal) {
      const realLegalHistory = await brsClient.fetchRealLegalHistory(symbol);
      const normalizedRealLegalRows = realLegalHistory
        .map((row) => normalizeRealLegalRow(symbol, row))
        .filter((row): row is Prisma.SymbolRealLegalDailyUncheckedCreateInput => row !== null);

      const realLegalStartedAt = Date.now();
      logger.info(
        {
          symbol,
          realLegalRowsToPersist: normalizedRealLegalRows.length
        },
        '💽 Persisting real/legal history to database'
      );
      await symbolRepository.upsertRealLegalRows(normalizedRealLegalRows);
      logger.info(
        {
          symbol,
          fetchedRealLegalRows: realLegalHistory.length,
          realLegalRowsUpserted: normalizedRealLegalRows.length,
          durationMs: Date.now() - realLegalStartedAt
        },
        '🏛️ Real/legal history persisted'
      );
    }

    logger.info(
      {
        symbol,
        includeRealLegal,
        totalDurationMs: Date.now() - startedAt
      },
      '✅ Symbol refresh completed'
    );

    return {
      tradeRows: normalizedTradeRows.length
    };
  }
};
