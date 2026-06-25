import { AlertRuleScope, AlertRuleType, WatchlistChangeEvent } from '@prisma/client';
import { z } from 'zod';

export const createAlertRuleBodySchema = z.object({
  type: z.nativeEnum(AlertRuleType),
  scope: z.nativeEnum(AlertRuleScope).optional(),
  symbol: z.string().trim().min(1).optional().nullable(),
  signalAction: z.string().trim().min(1).optional().nullable(),
  minScore: z.number().int().optional().nullable(),
  watchlistChangeEvent: z.nativeEnum(WatchlistChangeEvent).optional().nullable(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional()
});

export const alertRuleRouteParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export const alertRuleResponseSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(AlertRuleType),
  scope: z.nativeEnum(AlertRuleScope),
  symbol: z.string().nullable(),
  signalAction: z.string().nullable(),
  minScore: z.number().int().nullable(),
  watchlistChangeEvent: z.nativeEnum(WatchlistChangeEvent).nullable(),
  enabled: z.boolean(),
  cooldownMinutes: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const alertRuleListResponseSchema = z.object({
  status: z.literal('OK'),
  rules: z.array(alertRuleResponseSchema)
});

export const alertRuleCreateResponseSchema = z.object({
  status: z.literal('OK'),
  rule: alertRuleResponseSchema
});

export const alertRuleDeleteResponseSchema = z.object({
  status: z.literal('OK'),
  removed: z.object({
    id: z.string()
  })
});
