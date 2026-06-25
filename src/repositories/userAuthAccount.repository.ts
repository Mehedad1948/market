import type { AuthProvider, Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const userAuthAccountRepository = {
  async findByProviderAccount(
    provider: AuthProvider,
    providerAccountId: string
  ) {
    return prisma.userAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId
        }
      }
    });
  },

  async upsertByProviderAccount(data: Prisma.UserAuthAccountUncheckedCreateInput) {
    const {
      provider,
      providerAccountId,
      userId,
      providerEmail,
      providerPhone,
      metadata
    } = data;

    const createData: Prisma.UserAuthAccountUncheckedCreateInput = {
      provider,
      providerAccountId,
      userId,
      providerEmail: providerEmail ?? null,
      providerPhone: providerPhone ?? null
    };

    const updateData: Prisma.UserAuthAccountUncheckedUpdateInput = {
      userId,
      providerEmail: providerEmail ?? null,
      providerPhone: providerPhone ?? null
    };

    if (metadata !== undefined) {
      createData.metadata = metadata;
      updateData.metadata = metadata;
    }

    return prisma.userAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId
        }
      },
      create: createData,
      update: updateData
    });
  }
};
