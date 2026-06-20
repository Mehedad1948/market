import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type { InstrumentType, NormalizedCatalogSymbol } from '../types/symbolCatalog';
import { slugifySectorName } from '../utils/sectorDisplay';

const WRITE_CHUNK_SIZE = 250;

const chunkRows = <T>(rows: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
};

export type CatalogQueryFilters = {
  includeInactive: boolean;
  includeTypes?: InstrumentType[];
  search?: string;
};

export const symbolCatalogRepository = {
  async upsertSectors(
    sectors: Array<{ id: string; name: string; displayName: string | null }>
  ) {
    for (const sector of sectors) {
      await prisma.sector.upsert({
        where: {
          id: sector.id
        },
        update: {
          name: sector.name,
          displayName: sector.displayName,
          slug: slugifySectorName(sector.name)
        },
        create: {
          id: sector.id,
          name: sector.name,
          displayName: sector.displayName,
          slug: slugifySectorName(sector.name)
        }
      });
    }
  },

  async upsertSymbols(symbols: NormalizedCatalogSymbol[]) {
    const chunks = chunkRows(symbols, WRITE_CHUNK_SIZE);

    for (const chunk of chunks) {
      await prisma.$transaction(
        chunk.map((symbol) =>
          prisma.symbol.upsert({
            where: {
              symbol: symbol.symbol
            },
            update: {
              name: symbol.name,
              isin: symbol.isin,
              tsetmcId: symbol.tsetmcId,
              sectorId: symbol.sectorId,
              sectorName: symbol.sectorName,
              displaySector: symbol.displaySector,
              instrumentType: symbol.instrumentType,
              isActive: true,
              rawJson: symbol.rawJson as Prisma.InputJsonValue,
              lastSeenAt: symbol.lastSeenAt
            },
            create: {
              symbol: symbol.symbol,
              name: symbol.name,
              isin: symbol.isin,
              tsetmcId: symbol.tsetmcId,
              sectorId: symbol.sectorId,
              sectorName: symbol.sectorName,
              displaySector: symbol.displaySector,
              instrumentType: symbol.instrumentType,
              isActive: true,
              rawJson: symbol.rawJson as Prisma.InputJsonValue,
              lastSeenAt: symbol.lastSeenAt
            }
          })
        )
      );
    }
  },

  async deactivateMissingSymbols(seenSymbols: string[]) {
    return prisma.symbol.updateMany({
      where: {
        isActive: true,
        symbol: {
          notIn: seenSymbols
        }
      },
      data: {
        isActive: false
      }
    });
  },

  async findSymbols(filters: CatalogQueryFilters) {
    const where: Prisma.SymbolWhereInput = {
      ...(filters.includeInactive ? {} : { isActive: true }),
      ...(filters.includeTypes && filters.includeTypes.length > 0
        ? {
            instrumentType: {
              in: filters.includeTypes
            }
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                symbol: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              },
              {
                sectorName: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              },
              {
                displaySector: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              }
            ]
          }
        : {})
    };

    return prisma.symbol.findMany({
      where,
      orderBy: [{ symbol: 'asc' }, { name: 'asc' }]
    });
  },

  async getLatestCatalogTimestamp() {
    const latest = await prisma.symbol.findFirst({
      where: {
        lastSeenAt: {
          not: null
        }
      },
      orderBy: {
        lastSeenAt: 'desc'
      },
      select: {
        lastSeenAt: true
      }
    });

    return latest?.lastSeenAt ?? null;
  }
};
