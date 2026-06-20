import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const userRepository = {
  async create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({
      data
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  },

  async updateLastLogin(id: string, lastLoginAt = new Date()) {
    return prisma.user.update({
      where: { id },
      data: {
        lastLoginAt
      }
    });
  }
};
