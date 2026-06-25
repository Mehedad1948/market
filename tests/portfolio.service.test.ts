import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  listByUserId: vi.fn(),
  findByIdAndUserId: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
  deleteById: vi.fn(),
  createHolding: vi.fn(),
  updateHolding: vi.fn(),
  deleteHolding: vi.fn(),
  getLatestMetricsForSymbols: vi.fn(),
  getLatestActiveAnalysesForSymbols: vi.fn()
}));

vi.mock('../src/repositories/portfolio.repository', () => ({
  portfolioRepository: {
    listByUserId: repositoryMocks.listByUserId,
    findByIdAndUserId: repositoryMocks.findByIdAndUserId,
    create: repositoryMocks.create,
    updateName: repositoryMocks.updateName,
    deleteById: repositoryMocks.deleteById,
    createHolding: repositoryMocks.createHolding,
    updateHolding: repositoryMocks.updateHolding,
    deleteHolding: repositoryMocks.deleteHolding,
    getLatestMetricsForSymbols: repositoryMocks.getLatestMetricsForSymbols,
    getLatestActiveAnalysesForSymbols: repositoryMocks.getLatestActiveAnalysesForSymbols
  }
}));

import { portfolioService } from '../src/services/portfolio.service';

describe('portfolio.service', () => {
  beforeEach(() => {
    repositoryMocks.listByUserId.mockReset();
    repositoryMocks.findByIdAndUserId.mockReset();
    repositoryMocks.create.mockReset();
    repositoryMocks.updateName.mockReset();
    repositoryMocks.deleteById.mockReset();
    repositoryMocks.createHolding.mockReset();
    repositoryMocks.updateHolding.mockReset();
    repositoryMocks.deleteHolding.mockReset();
    repositoryMocks.getLatestMetricsForSymbols.mockReset();
    repositoryMocks.getLatestActiveAnalysesForSymbols.mockReset();

    repositoryMocks.getLatestMetricsForSymbols.mockResolvedValue([]);
    repositoryMocks.getLatestActiveAnalysesForSymbols.mockResolvedValue([]);
  });

  it('builds portfolio metrics, concentration, and holding guidance from current data', async () => {
    repositoryMocks.listByUserId.mockResolvedValue([
      {
        id: 'portfolio-1',
        userId: 'user-1',
        name: 'Core',
        isDefault: true,
        createdAt: new Date('2026-06-25T10:00:00.000Z'),
        updatedAt: new Date('2026-06-25T10:00:00.000Z'),
        holdings: [
          {
            id: 'holding-1',
            portfolioId: 'portfolio-1',
            symbol: 'FMLI',
            quantity: new Prisma.Decimal('10'),
            averageBuyPrice: new Prisma.Decimal('100'),
            notes: 'Main position',
            createdAt: new Date('2026-06-25T10:00:00.000Z'),
            updatedAt: new Date('2026-06-25T10:00:00.000Z')
          },
          {
            id: 'holding-2',
            portfolioId: 'portfolio-1',
            symbol: 'AUTO',
            quantity: new Prisma.Decimal('20'),
            averageBuyPrice: new Prisma.Decimal('40'),
            notes: null,
            createdAt: new Date('2026-06-25T10:00:00.000Z'),
            updatedAt: new Date('2026-06-25T10:00:00.000Z')
          }
        ]
      }
    ]);

    repositoryMocks.getLatestMetricsForSymbols.mockResolvedValue([
      {
        symbol: 'AUTO',
        date: '1405-04-04',
        closePrice: new Prisma.Decimal('50'),
        closePriceChangePercent: new Prisma.Decimal('0.02')
      },
      {
        symbol: 'FMLI',
        date: '1405-04-04',
        closePrice: new Prisma.Decimal('120'),
        closePriceChangePercent: new Prisma.Decimal('0.05')
      }
    ]);

    repositoryMocks.getLatestActiveAnalysesForSymbols.mockResolvedValue([
      {
        symbol: 'FMLI',
        analyzedAt: new Date('2026-06-25T10:05:00.000Z'),
        result: {
          persianSummary: 'نگهداری با احتیاط',
          signals: {
            composite: {
              score: 18,
              action: { value: 'CAUTION', label: 'احتیاط' },
              bias: { value: 'NEUTRAL', label: 'خنثی' },
              entryTiming: { value: 'RISKY', label: 'پرریسک' },
              timeframes: {
                shortTerm: {
                  positionAdvice: {
                    forExistingPosition: {
                      value: 'REDUCE',
                      label: 'کاهش'
                    }
                  }
                },
                midTerm: {
                  positionAdvice: {
                    forExistingPosition: {
                      value: 'HOLD_WITH_CAUTION',
                      label: 'نگهداری با احتیاط'
                    }
                  }
                },
                longTerm: {
                  positionAdvice: {
                    forExistingPosition: {
                      value: 'HOLD',
                      label: 'نگهداری'
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]);

    const [portfolio] = await portfolioService.listPortfolios('user-1');

    expect(repositoryMocks.listByUserId).toHaveBeenCalledWith('user-1');
    expect(portfolio.metrics).toMatchObject({
      holdingsCount: 2,
      pricedHoldingsCount: 2,
      totalCostBasis: 1800,
      totalMarketValue: 2200,
      totalUnrealizedProfitLoss: 400,
      totalUnrealizedProfitLossPercent: 0.2222,
      topHoldingWeight: 0.5455,
      top3Weight: 1,
      concentrationHhi: 0.5041
    });
    expect(portfolio.holdings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'FMLI',
          currentPrice: 120,
          concentrationWeight: 0.5455,
          metrics: expect.objectContaining({
            costBasis: 1000,
            marketValue: 1200,
            unrealizedProfitLoss: 200,
            unrealizedProfitLossPercent: 0.2
          }),
          actionGuidance: expect.objectContaining({
            compositeAction: 'CAUTION',
            recommendedAction: 'REDUCE'
          })
        }),
        expect.objectContaining({
          symbol: 'AUTO',
          currentPrice: 50,
          concentrationWeight: 0.4545,
          actionGuidance: null
        })
      ])
    );
  });

  it('denies access to a portfolio outside the authenticated user scope', async () => {
    repositoryMocks.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      portfolioService.getPortfolio('user-1', 'portfolio-2')
    ).rejects.toMatchObject({
      statusCode: 404,
      payload: {
        englishMessage: 'Portfolio not found'
      }
    });
  });

  it('rejects duplicate holdings within the same portfolio', async () => {
    repositoryMocks.findByIdAndUserId.mockResolvedValue({
      id: 'portfolio-1',
      userId: 'user-1',
      name: 'Core',
      isDefault: false,
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      holdings: []
    });
    repositoryMocks.createHolding.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );

    await expect(
      portfolioService.addHolding('user-1', 'portfolio-1', {
        symbol: 'FMLI',
        quantity: 10,
        averageBuyPrice: 100
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      payload: {
        englishMessage: 'Holding already exists in portfolio'
      }
    });
  });

  it('updates holdings idempotently by normalized symbol within the owned portfolio', async () => {
    const portfolio = {
      id: 'portfolio-1',
      userId: 'user-1',
      name: 'Core',
      isDefault: false,
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      holdings: [
        {
          id: 'holding-1',
          portfolioId: 'portfolio-1',
          symbol: 'FMLI',
          quantity: new Prisma.Decimal('10'),
          averageBuyPrice: new Prisma.Decimal('100'),
          notes: null,
          createdAt: new Date('2026-06-25T10:00:00.000Z'),
          updatedAt: new Date('2026-06-25T10:00:00.000Z')
        }
      ]
    };

    repositoryMocks.findByIdAndUserId
      .mockResolvedValueOnce(portfolio)
      .mockResolvedValueOnce(portfolio);
    repositoryMocks.updateHolding.mockResolvedValue({
      id: 'holding-1'
    });

    await portfolioService.updateHolding('user-1', 'portfolio-1', ' fmli ', {
      quantity: 10,
      averageBuyPrice: 100,
      notes: 'trim me'
    });

    expect(repositoryMocks.updateHolding).toHaveBeenCalledWith(
      'portfolio-1',
      'FMLI',
      {
        quantity: '10',
        averageBuyPrice: '100',
        notes: 'trim me'
      }
    );
  });
});
