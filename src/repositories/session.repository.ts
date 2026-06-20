import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const sessionRepository = {
  async create(data: Prisma.UserSessionUncheckedCreateInput) {
    return prisma.userSession.create({
      data
    });
  },

  async findActiveByTokenHash(tokenHash: string, now = new Date()) {
    return prisma.userSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: {
        user: true
      }
    });
  },

  async revokeById(id: string, revokedAt = new Date()) {
    return prisma.userSession.update({
      where: { id },
      data: {
        revokedAt
      }
    });
  },

  async deleteExpired(now = new Date()) {
    return prisma.userSession.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now
            }
          },
          {
            revokedAt: {
              not: null,
              lt: now
            }
          }
        ]
      }
    });
  }
};
