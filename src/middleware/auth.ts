import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errorHandler';
import { authService, extractBearerToken } from '../services/auth.service';

const initializeAnonymousAuth = (request: Request) => {
  request.auth = authService.buildAnonymousAuthContext();
  request.currentUser = null;
};

export const authMiddleware = async (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  initializeAnonymousAuth(request);

  const headerValue = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const token = extractBearerToken(headerValue);

  if (!token) {
    next();
    return;
  }

  try {
    const authContext = await authService.getAuthContextFromToken(token);
    request.auth = authContext;
    request.currentUser = authContext.user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuthenticatedUser = (request: Request) => {
  if (!request.auth?.isAuthenticated || !request.currentUser) {
    throw new AppError('نیاز به احراز هویت دارید.', 401, {
      englishMessage: 'Authentication required'
    });
  }

  return request.currentUser;
};
