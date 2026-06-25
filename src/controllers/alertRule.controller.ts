import type { NextFunction, Request, Response } from 'express';

import { createAlertRuleBodySchema } from '../contracts/alertRule.contract';
import { requireAuthenticatedUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { alertRuleService } from '../services/alertRule.service';

const getRouteId = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

export const listAlertRules = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const rules = await alertRuleService.listRules(user.id);

    response.json({
      status: 'OK',
      rules
    });
  } catch (error) {
    next(error);
  }
};

export const createAlertRule = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const parsed = createAlertRuleBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست قانون هشدار معتبر نیست.', 400, {
        englishMessage: 'Invalid alert rule payload',
        issues: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const rule = await alertRuleService.createRule({
      userId: user.id,
      type: payload.type,
      ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
      ...(payload.symbol !== undefined ? { symbol: payload.symbol } : {}),
      ...(payload.signalAction !== undefined
        ? { signalAction: payload.signalAction }
        : {}),
      ...(payload.minScore !== undefined ? { minScore: payload.minScore } : {}),
      ...(payload.watchlistChangeEvent !== undefined
        ? { watchlistChangeEvent: payload.watchlistChangeEvent }
        : {}),
      ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      ...(payload.cooldownMinutes !== undefined
        ? { cooldownMinutes: payload.cooldownMinutes }
        : {})
    });

    response.status(201).json({
      status: 'OK',
      rule
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAlertRule = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const ruleId = getRouteId(request.params.id);
    if (!ruleId) {
      throw new AppError('شناسه قانون هشدار ارسال نشده است.', 400, {
        englishMessage: 'Alert rule id is required'
      });
    }

    const removed = await alertRuleService.deleteRule(user.id, ruleId);
    response.json({
      status: 'OK',
      removed
    });
  } catch (error) {
    next(error);
  }
};
