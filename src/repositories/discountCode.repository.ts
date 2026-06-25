import { DiscountCodeStatus, type Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

const includeDefinition = {
  applicablePlans: {
    include: {
      plan: true
    }
  }
} satisfies Prisma.DiscountCodeInclude;

export const discountCodeRepository = {
  async create(
    data: Prisma.DiscountCodeCreateInput,
    applicablePlanIds: string[]
  ) {
    const createData: Prisma.DiscountCodeCreateInput = {
      ...data,
      ...(applicablePlanIds.length > 0
        ? {
            applicablePlans: {
              create: applicablePlanIds.map((planId) => ({
                plan: {
                  connect: {
                    id: planId
                  }
                }
              }))
            }
          }
        : {})
    };

    return prisma.discountCode.create({
      data: createData,
      include: includeDefinition
    });
  },

  async findById(id: string) {
    return prisma.discountCode.findUnique({
      where: {
        id
      },
      include: includeDefinition
    });
  },

  async findByCode(code: string) {
    return prisma.discountCode.findUnique({
      where: {
        code
      },
      include: includeDefinition
    });
  },

  async updateStatus(id: string, status: DiscountCodeStatus) {
    return prisma.discountCode.update({
      where: {
        id
      },
      data: {
        status
      },
      include: includeDefinition
    });
  },

  async incrementRedemptionCountIfAvailable(id: string, now: Date) {
    return prisma.$executeRaw`
      UPDATE "DiscountCode"
      SET "redemptionCount" = "redemptionCount" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "status" = 'ACTIVE'::"DiscountCodeStatus"
        AND ("startsAt" IS NULL OR "startsAt" <= ${now})
        AND ("endsAt" IS NULL OR "endsAt" > ${now})
        AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")
    `;
  }
};
