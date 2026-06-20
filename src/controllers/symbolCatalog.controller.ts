import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { BrsApiError } from '../services/brsClient';
import { symbolCatalogService } from '../services/symbolCatalog.service';
import type { InstrumentType } from '../types/symbolCatalog';

const instrumentTypes = ['STOCK', 'ETF', 'RIGHT', 'BOND', 'UNKNOWN'] as const;

const booleanQueryParam = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }

    return value;
  }, z.coerce.boolean().default(defaultValue));

const groupedQuerySchema = z.object({
  grouping: z.enum(['macro', 'official']).default('macro'),
  hideDuplicateBoards: booleanQueryParam(true),
  includeInactive: booleanQueryParam(false),
  includeTypes: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const parsed = value
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      return parsed as InstrumentType[];
    })
    .refine(
      (value) =>
        value === undefined ||
        value.every((item) =>
          instrumentTypes.includes(item as (typeof instrumentTypes)[number])
        ),
      {
        message: 'includeTypes contains unsupported instrument types.'
      }
    ),
  search: z.string().trim().optional(),
  format: z.enum(['array', 'object']).default('array')
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1)
});

const mapSymbolsApiError = (error: unknown) => {
  if (error instanceof BrsApiError) {
    throw new AppError('خطا در دریافت فهرست نمادها از BrsApi', 502, {
      englishMessage: 'Failed to fetch symbols from BrsApi'
    });
  }

  throw error;
};

export const importSymbols = async (
  _request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    response.json(await symbolCatalogService.importSymbols());
  } catch (error) {
    try {
      mapSymbolsApiError(error);
    } catch (mappedError) {
      next(mappedError);
    }
  }
};

export const getGroupedSymbols = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const query = groupedQuerySchema.parse(request.query);
    const options = {
      grouping: query.grouping,
      hideDuplicateBoards: query.hideDuplicateBoards,
      includeInactive: query.includeInactive,
      format: query.format,
      ...(query.includeTypes ? { includeTypes: query.includeTypes } : {}),
      ...(query.search ? { search: query.search } : {})
    };

    response.json(
      await symbolCatalogService.getGroupedCatalog(options)
    );
  } catch (error) {
    next(error);
  }
};

export const searchSymbols = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const query = searchQuerySchema.parse(request.query);
    response.json(await symbolCatalogService.searchSymbols(query.q));
  } catch (error) {
    next(error);
  }
};
