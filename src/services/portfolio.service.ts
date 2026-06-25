import type { AnalysisCache, Portfolio, PortfolioHolding, SymbolDailyMetric } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { AppError } from '../middleware/errorHandler';
import { portfolioRepository } from '../repositories/portfolio.repository';
import type { ExistingPositionAdvice, StockAnalysisResult } from '../types';

type PortfolioWithHoldings = Portfolio & {
  holdings: PortfolioHolding[];
};

type HoldingMetrics = {
  costBasis: number | null;
  marketValue: number | null;
  unrealizedProfitLoss: number | null;
  unrealizedProfitLossPercent: number | null;
};

type HoldingActionGuidance = {
  compositeAction: string;
  bias: string;
  score: number;
  entryTiming: string;
  recommendedAction: ExistingPositionAdvice;
  existingPositionAdvice: {
    shortTerm: ExistingPositionAdvice;
    midTerm: ExistingPositionAdvice;
    longTerm: ExistingPositionAdvice;
  };
  persianSummary: string;
  analyzedAt: string;
};

const DEFAULT_PORTFOLIO_NAME = 'Default';

const toNumber = (value: { toString(): string } | null | undefined): number | null => {
  return value === null || value === undefined ? null : Number(value.toString());
};

const roundMetric = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(4));
};

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveRecommendedAction = (guidance: {
  shortTerm: ExistingPositionAdvice;
  midTerm: ExistingPositionAdvice;
  longTerm: ExistingPositionAdvice;
}): ExistingPositionAdvice => {
  const priorities: ExistingPositionAdvice[] = [
    'EXIT',
    'REDUCE',
    'HOLD_WITH_CAUTION',
    'MONITOR',
    'HOLD'
  ];

  for (const priority of priorities) {
    if (
      guidance.shortTerm === priority ||
      guidance.midTerm === priority ||
      guidance.longTerm === priority
    ) {
      return priority;
    }
  }

  return 'MONITOR';
};

const buildHoldingActionGuidance = (analysis: AnalysisCache | null): HoldingActionGuidance | null => {
  if (!analysis?.result || typeof analysis.result !== 'object') {
    return null;
  }

  const result = analysis.result as unknown as StockAnalysisResult;
  const composite = result.signals?.composite;
  const timeframes = composite?.timeframes;
  const shortTerm = timeframes?.shortTerm?.positionAdvice?.forExistingPosition?.value;
  const midTerm = timeframes?.midTerm?.positionAdvice?.forExistingPosition?.value;
  const longTerm = timeframes?.longTerm?.positionAdvice?.forExistingPosition?.value;
  const compositeAction = composite?.action?.value;
  const bias = composite?.bias?.value;
  const score = composite?.score;
  const entryTiming = composite?.entryTiming?.value;

  if (
    typeof compositeAction !== 'string' ||
    typeof bias !== 'string' ||
    typeof score !== 'number' ||
    typeof entryTiming !== 'string' ||
    typeof shortTerm !== 'string' ||
    typeof midTerm !== 'string' ||
    typeof longTerm !== 'string'
  ) {
    return null;
  }

  const existingPositionAdvice = {
    shortTerm: shortTerm as ExistingPositionAdvice,
    midTerm: midTerm as ExistingPositionAdvice,
    longTerm: longTerm as ExistingPositionAdvice
  };

  return {
    compositeAction,
    bias,
    score,
    entryTiming,
    recommendedAction: resolveRecommendedAction(existingPositionAdvice),
    existingPositionAdvice,
    persianSummary: result.persianSummary,
    analyzedAt: analysis.analyzedAt.toISOString()
  };
};

const computeHoldingMetrics = ({
  quantity,
  averageBuyPrice,
  currentPrice
}: {
  quantity: number;
  averageBuyPrice: number | null;
  currentPrice: number | null;
}): HoldingMetrics => {
  const costBasis = averageBuyPrice === null ? null : quantity * averageBuyPrice;
  const marketValue = currentPrice === null ? null : quantity * currentPrice;

  if (costBasis === null || marketValue === null) {
    return {
      costBasis: roundMetric(costBasis),
      marketValue: roundMetric(marketValue),
      unrealizedProfitLoss: null,
      unrealizedProfitLossPercent: null
    };
  }

  const unrealizedProfitLoss = marketValue - costBasis;
  const unrealizedProfitLossPercent =
    costBasis === 0 ? null : unrealizedProfitLoss / costBasis;

  return {
    costBasis: roundMetric(costBasis),
    marketValue: roundMetric(marketValue),
    unrealizedProfitLoss: roundMetric(unrealizedProfitLoss),
    unrealizedProfitLossPercent: roundMetric(unrealizedProfitLossPercent)
  };
};

const buildPortfolioState = async (portfolios: PortfolioWithHoldings[]) => {
  const symbols = [...new Set(
    portfolios.flatMap((portfolio) => portfolio.holdings.map((holding) => holding.symbol))
  )];
  const now = new Date();
  const [metricsRows, analysisRows] = await Promise.all([
    portfolioRepository.getLatestMetricsForSymbols(symbols),
    portfolioRepository.getLatestActiveAnalysesForSymbols(symbols, now)
  ]);

  const latestMetricBySymbol = new Map<string, SymbolDailyMetric>();
  for (const row of metricsRows) {
    if (!latestMetricBySymbol.has(row.symbol)) {
      latestMetricBySymbol.set(row.symbol, row);
    }
  }

  const latestAnalysisBySymbol = new Map<string, AnalysisCache>();
  for (const row of analysisRows) {
    if (!latestAnalysisBySymbol.has(row.symbol)) {
      latestAnalysisBySymbol.set(row.symbol, row);
    }
  }

  return portfolios.map((portfolio) => {
    const holdings = portfolio.holdings.map((holding) => {
      const quantity = toNumber(holding.quantity) ?? 0;
      const averageBuyPrice = toNumber(holding.averageBuyPrice);
      const latestMetric = latestMetricBySymbol.get(holding.symbol);
      const currentPrice = toNumber(latestMetric?.closePrice ?? null);
      const latestClosePriceChangePercent = toNumber(
        latestMetric?.closePriceChangePercent ?? null
      );
      const metrics = computeHoldingMetrics({
        quantity,
        averageBuyPrice,
        currentPrice
      });

      return {
        id: holding.id,
        symbol: holding.symbol,
        quantity,
        averageBuyPrice,
        notes: holding.notes,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
        latestDataDate: latestMetric?.date ?? null,
        currentPrice,
        latestClosePriceChangePercent,
        metrics,
        actionGuidance: buildHoldingActionGuidance(
          latestAnalysisBySymbol.get(holding.symbol) ?? null
        )
      };
    });

    const pricedHoldings = holdings.filter(
      (holding) => holding.metrics.marketValue !== null
    );
    const totalMarketValue = pricedHoldings.reduce((sum, holding) => {
      return sum + (holding.metrics.marketValue ?? 0);
    }, 0);
    const totalCostBasis = holdings.reduce((sum, holding) => {
      return sum + (holding.metrics.costBasis ?? 0);
    }, 0);
    const totalUnrealizedProfitLoss = holdings.reduce((sum, holding) => {
      return sum + (holding.metrics.unrealizedProfitLoss ?? 0);
    }, 0);

    const holdingsWithWeights = holdings.map((holding) => {
      const concentrationWeight =
        totalMarketValue > 0 && holding.metrics.marketValue !== null
          ? roundMetric(holding.metrics.marketValue / totalMarketValue)
          : null;

      return {
        ...holding,
        concentrationWeight
      };
    });

    const sortedWeights = holdingsWithWeights
      .map((holding) => holding.concentrationWeight)
      .filter((value): value is number => value !== null)
      .sort((left, right) => right - left);

    const topHoldingWeight = sortedWeights[0] ?? null;
    const top3Weight =
      sortedWeights.length === 0
        ? null
        : roundMetric(sortedWeights.slice(0, 3).reduce((sum, value) => sum + value, 0));
    const concentrationHhi =
      sortedWeights.length === 0
        ? null
        : roundMetric(
            sortedWeights.reduce((sum, value) => sum + value * value, 0)
          );
    const totalUnrealizedProfitLossPercent =
      totalCostBasis > 0
        ? roundMetric(totalUnrealizedProfitLoss / totalCostBasis)
        : null;

    return {
      id: portfolio.id,
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      metrics: {
        holdingsCount: holdingsWithWeights.length,
        pricedHoldingsCount: pricedHoldings.length,
        unpricedHoldingsCount: holdingsWithWeights.length - pricedHoldings.length,
        totalCostBasis: roundMetric(totalCostBasis),
        totalMarketValue: roundMetric(totalMarketValue),
        totalUnrealizedProfitLoss: roundMetric(totalUnrealizedProfitLoss),
        totalUnrealizedProfitLossPercent,
        topHoldingWeight,
        top3Weight,
        concentrationHhi
      },
      holdings: holdingsWithWeights
    };
  });
};

const getOwnedPortfolio = async (userId: string, portfolioId: string) => {
  const portfolio = await portfolioRepository.findByIdAndUserId(portfolioId, userId);
  if (!portfolio) {
    throw new AppError('سبد سرمایه‌گذاری یافت نشد.', 404, {
      englishMessage: 'Portfolio not found'
    });
  }

  return portfolio;
};

export const portfolioService = {
  async listPortfolios(userId: string) {
    const portfolios = await portfolioRepository.listByUserId(userId);
    return buildPortfolioState(portfolios);
  },

  async getPortfolio(userId: string, portfolioId: string) {
    const portfolio = await getOwnedPortfolio(userId, portfolioId);
    const [result] = await buildPortfolioState([portfolio]);
    return result;
  },

  async createPortfolio(userId: string, rawName?: string | null) {
    const name = normalizeOptionalText(rawName) ?? DEFAULT_PORTFOLIO_NAME;
    const portfolio = await portfolioRepository.create(userId, name);
    const [result] = await buildPortfolioState([portfolio]);
    return result;
  },

  async renamePortfolio(userId: string, portfolioId: string, rawName: string) {
    await getOwnedPortfolio(userId, portfolioId);
    const name = normalizeOptionalText(rawName);
    if (!name) {
      throw new AppError('نام سبد سرمایه‌گذاری معتبر نیست.', 400, {
        englishMessage: 'Portfolio name is required'
      });
    }

    const portfolio = await portfolioRepository.updateName(portfolioId, name);
    const [result] = await buildPortfolioState([portfolio]);
    return result;
  },

  async deletePortfolio(userId: string, portfolioId: string) {
    const portfolio = await getOwnedPortfolio(userId, portfolioId);
    await portfolioRepository.deleteById(portfolio.id);

    return {
      id: portfolio.id,
      name: portfolio.name
    };
  },

  async addHolding(
    userId: string,
    portfolioId: string,
    input: {
      symbol: string;
      quantity: number;
      averageBuyPrice?: number | null;
      notes?: string | null | undefined;
    }
  ) {
    const portfolio = await getOwnedPortfolio(userId, portfolioId);
    const symbol = normalizeSymbol(input.symbol);
    if (!symbol) {
      throw new AppError('نماد معتبر نیست.', 400, {
        englishMessage: 'Symbol is required'
      });
    }

    try {
      await portfolioRepository.createHolding(portfolio.id, {
        symbol,
        quantity: input.quantity.toString(),
        averageBuyPrice:
          input.averageBuyPrice === undefined || input.averageBuyPrice === null
            ? null
            : input.averageBuyPrice.toString(),
        notes: normalizeOptionalText(input.notes)
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('این نماد قبلا در سبد ثبت شده است.', 409, {
          englishMessage: 'Holding already exists in portfolio'
        });
      }

      throw error;
    }

    return this.getPortfolio(userId, portfolioId);
  },

  async updateHolding(
    userId: string,
    portfolioId: string,
    rawSymbol: string,
    input: {
      quantity: number;
      averageBuyPrice?: number | null | undefined;
      notes?: string | null | undefined;
    }
  ) {
    const portfolio = await getOwnedPortfolio(userId, portfolioId);
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      throw new AppError('نماد معتبر نیست.', 400, {
        englishMessage: 'Symbol is required'
      });
    }

    try {
      await portfolioRepository.updateHolding(portfolio.id, symbol, {
        quantity: input.quantity.toString(),
        averageBuyPrice:
          input.averageBuyPrice === undefined || input.averageBuyPrice === null
            ? null
            : input.averageBuyPrice.toString(),
        notes: normalizeOptionalText(input.notes)
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppError('دارایی در سبد یافت نشد.', 404, {
          englishMessage: 'Holding not found in portfolio'
        });
      }

      throw error;
    }

    return this.getPortfolio(userId, portfolioId);
  },

  async removeHolding(userId: string, portfolioId: string, rawSymbol: string) {
    const portfolio = await getOwnedPortfolio(userId, portfolioId);
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      throw new AppError('نماد معتبر نیست.', 400, {
        englishMessage: 'Symbol is required'
      });
    }

    try {
      await portfolioRepository.deleteHolding(portfolio.id, symbol);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppError('دارایی در سبد یافت نشد.', 404, {
          englishMessage: 'Holding not found in portfolio'
        });
      }

      throw error;
    }

    return this.getPortfolio(userId, portfolioId);
  }
};
