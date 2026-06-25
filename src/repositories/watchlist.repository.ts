import { prisma } from '../lib/prisma';

export const watchlistRepository = {
  async listByUserId(userId: string) {
    return prisma.userWatchlistItem.findMany({
      where: {
        userId
      },
      orderBy: [{ createdAt: 'desc' }, { symbol: 'asc' }]
    });
  },

  async countByUserId(userId: string) {
    return prisma.userWatchlistItem.count({
      where: {
        userId
      }
    });
  },

  async create(userId: string, symbol: string) {
    return prisma.userWatchlistItem.create({
      data: {
        userId,
        symbol
      }
    });
  },

  async deleteByUserIdAndSymbol(userId: string, symbol: string) {
    return prisma.userWatchlistItem.deleteMany({
      where: {
        userId,
        symbol
      }
    });
  }
};
