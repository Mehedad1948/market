import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errorHandler';
import { requireAuthenticatedUser } from './auth';
import { subscriptionService } from '../services/subscription.service';
import type { AccessLevel } from '../types/subscription';

const ACCESS_LEVEL_PRIORITY: Record<AccessLevel, number> = {
  NONE: 0,
  TRIAL: 1,
  PAID: 2
};

export const attachSubscriptionAccess = async (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    request.subscriptionAccess = await subscriptionService.resolveAccessForUser(user.id);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSubscriptionAccess = (minimumLevel: Exclude<AccessLevel, 'NONE'> = 'TRIAL') => {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const user = requireAuthenticatedUser(request);
      const access =
        request.subscriptionAccess ??
        (await subscriptionService.resolveAccessForUser(user.id));

      request.subscriptionAccess = access;

      if (
        !access.hasAccess ||
        ACCESS_LEVEL_PRIORITY[access.level] < ACCESS_LEVEL_PRIORITY[minimumLevel]
      ) {
        throw new AppError('اشتراک فعال موردنیاز است.', 403, {
          englishMessage: 'Active subscription required',
          accessLevel: access.level,
          accessReason: access.reason
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
