import type { OtpChannel, OtpPurpose, Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const otpCodeRepository = {
  async create(data: Prisma.OtpCodeUncheckedCreateInput) {
    return prisma.otpCode.create({
      data
    });
  },

  async consume(id: string, consumedAt = new Date()) {
    return prisma.otpCode.update({
      where: { id },
      data: {
        consumedAt
      }
    });
  },

  async consumeActiveForTarget(
    channel: OtpChannel,
    target: string,
    purpose: OtpPurpose,
    consumedAt = new Date()
  ) {
    return prisma.otpCode.updateMany({
      where: {
        channel,
        target,
        purpose,
        consumedAt: null,
        expiresAt: {
          gt: consumedAt
        }
      },
      data: {
        consumedAt
      }
    });
  },

  async findLatestActiveByTarget(
    channel: OtpChannel,
    target: string,
    purpose: OtpPurpose,
    now = new Date()
  ) {
    return prisma.otpCode.findFirst({
      where: {
        channel,
        target,
        purpose,
        consumedAt: null,
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  },

  async findLatestByTarget(
    channel: OtpChannel,
    target: string,
    purpose: OtpPurpose
  ) {
    return prisma.otpCode.findFirst({
      where: {
        channel,
        target,
        purpose
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
};
