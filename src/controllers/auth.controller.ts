import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../middleware/errorHandler';
import { requireAuthenticatedUser } from '../middleware/auth';
import { authService } from '../services/auth.service';

export const getCurrentAuth = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const session = request.auth.session;
    const user = request.currentUser;

    response.json({
      status: 'OK',
      authenticated: request.auth.isAuthenticated,
      user,
      session: session
        ? {
            id: session.id,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt
          }
        : null
    });
  } catch (error) {
    next(error);
  }
};

export const logoutCurrentSession = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    requireAuthenticatedUser(request);

    const session = request.auth.session;
    if (!session) {
      throw new AppError('نشست کاربر معتبر نیست.', 401, {
        englishMessage: 'Active session not found'
      });
    }

    await authService.revokeSession(session.id);

    response.json({
      status: 'OK',
      loggedOut: true
    });
  } catch (error) {
    next(error);
  }
};
