import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { AppError } from './errorHandler';

export const requireInternalApiToken = (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  try {
    if (!env.INTERNAL_API_TOKEN) {
      throw new AppError('توکن دسترسی داخلی پیکربندی نشده است.', 503, {
        englishMessage: 'Internal API token is not configured'
      });
    }

    const header = request.headers['x-internal-api-token'];
    const token = Array.isArray(header) ? header[0] : header;

    if (!token || token !== env.INTERNAL_API_TOKEN) {
      throw new AppError('توکن دسترسی داخلی معتبر نیست.', 401, {
        englishMessage: 'Invalid internal API token'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
