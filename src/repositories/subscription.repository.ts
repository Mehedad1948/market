import { prisma } from '../lib/prisma';

export const subscriptionRepository = {
  async findByUserId(userId: string) {
    return prisma.subscription.findMany({
      where: {
        userId
      },
      include: {
        plan: true
      },
      orderBy: [{ endsAt: 'desc' }, { createdAt: 'desc' }]
    });
  }
};
