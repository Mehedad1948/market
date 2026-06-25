import { prisma } from '../lib/prisma';

export const portfolioRepository = {
  async listByUserId(userId: string) {
    return prisma.portfolio.findMany({
      where: {
        userId
      },
      include: {
        holdings: {
          orderBy: [{ createdAt: 'asc' }, { symbol: 'asc' }]
        }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
  },

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.portfolio.findFirst({
      where: {
        id,
        userId
      },
      include: {
        holdings: {
          orderBy: [{ createdAt: 'asc' }, { symbol: 'asc' }]
        }
      }
    });
  },

  async create(userId: string, name: string) {
    return prisma.portfolio.create({
      data: {
        userId,
        name
      },
      include: {
        holdings: {
          orderBy: [{ createdAt: 'asc' }, { symbol: 'asc' }]
        }
      }
    });
  },

  async updateName(id: string, name: string) {
    return prisma.portfolio.update({
      where: {
        id
      },
      data: {
        name
      },
      include: {
        holdings: {
          orderBy: [{ createdAt: 'asc' }, { symbol: 'asc' }]
        }
      }
    });
  },

  async deleteById(id: string) {
    return prisma.portfolio.delete({
      where: {
        id
      },
      include: {
        holdings: true
      }
    });
  },

  async createHolding(portfolioId: string, data: {
    symbol: string;
    quantity: string;
    averageBuyPrice: string | null;
    notes: string | null;
  }) {
    return prisma.portfolioHolding.create({
      data: {
        portfolioId,
        ...data
      }
    });
  },

  async updateHolding(
    portfolioId: string,
    symbol: string,
    data: {
      quantity: string;
      averageBuyPrice: string | null;
      notes: string | null;
    }
  ) {
    return prisma.portfolioHolding.update({
      where: {
        portfolioId_symbol: {
          portfolioId,
          symbol
        }
      },
      data
    });
  },

  async deleteHolding(portfolioId: string, symbol: string) {
    return prisma.portfolioHolding.delete({
      where: {
        portfolioId_symbol: {
          portfolioId,
          symbol
        }
      }
    });
  },

  async getLatestMetricsForSymbols(symbols: string[]) {
    if (symbols.length === 0) {
      return [];
    }

    return prisma.symbolDailyMetric.findMany({
      where: {
        symbol: {
          in: symbols
        }
      },
      orderBy: [{ symbol: 'asc' }, { date: 'desc' }]
    });
  },

  async getLatestActiveAnalysesForSymbols(symbols: string[], now: Date) {
    if (symbols.length === 0) {
      return [];
    }

    return prisma.analysisCache.findMany({
      where: {
        symbol: {
          in: symbols
        },
        expiresAt: {
          gt: now
        }
      },
      orderBy: [{ symbol: 'asc' }, { analyzedAt: 'desc' }]
    });
  }
};
