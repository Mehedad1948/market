import { z } from 'zod';

export const watchlistBodySchema = z.object({
  symbol: z.string().trim().min(1)
});

export const watchlistRouteParamsSchema = z.object({
  symbol: z.string().trim().min(1)
});

export const watchlistItemResponseSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  createdAt: z.string().datetime()
});

export const watchlistListResponseSchema = z.object({
  status: z.literal('OK'),
  items: z.array(watchlistItemResponseSchema)
});

export const watchlistCreateResponseSchema = z.object({
  status: z.literal('OK'),
  item: watchlistItemResponseSchema
});

export const watchlistDeleteResponseSchema = z.object({
  status: z.literal('OK'),
  removed: z.object({
    symbol: z.string()
  })
});
