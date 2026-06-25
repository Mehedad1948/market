import { prisma } from '../lib/prisma';

export const planRepository = {
  async findByCode(code: string) {
    return prisma.plan.findUnique({
      where: {
        code
      }
    });
  },

  async findActiveByCode(code: string) {
    return prisma.plan.findFirst({
      where: {
        code,
        isActive: true
      }
    });
  },

  async findByCodes(codes: string[]) {
    return prisma.plan.findMany({
      where: {
        code: {
          in: codes
        }
      }
    });
  }
};
