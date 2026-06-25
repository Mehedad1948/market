import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { requireAuthenticatedUser } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { subscriptionService } from '../services/subscription.service';

const baleCallbackBodySchema = z.object({
  baleUser: z.object({
    id: z.union([z.string(), z.number()]).transform((value) => String(value)),
    username: z.string().trim().min(1).optional().nullable(),
    firstName: z.string().trim().min(1).optional().nullable(),
    lastName: z.string().trim().min(1).optional().nullable(),
    avatarUrl: z.string().trim().url().optional().nullable()
  }),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().min(3).optional().nullable(),
  displayName: z.string().trim().min(1).optional().nullable()
});

const getRequestIp = (request: Request) => {
  if (typeof request.ip === 'string' && request.ip.trim().length > 0) {
    return request.ip;
  }

  return null;
};

const getRequestUserAgent = (request: Request) => {
  const header = request.headers['user-agent'];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return header ?? null;
};

const assertBaleBotToken = (request: Request) => {
  const header = request.headers['x-bale-bot-token'];
  const value = Array.isArray(header) ? header[0] : header;
  const expectedToken = process.env.BALE_BOT_TOKEN ?? '';

  if (!value || value !== expectedToken) {
    throw new AppError('توکن احراز هویت بله معتبر نیست.', 401, {
      englishMessage: 'Invalid Bale bot token'
    });
  }
};

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

export const authenticateWithBale = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    assertBaleBotToken(request);

    const parsed = baleCallbackBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست احراز هویت بله معتبر نیست.', 400, {
        englishMessage: 'Invalid Bale auth payload',
        issues: parsed.error.flatten()
      });
    }

    const result = await authService.authenticateWithBale({
      baleUser: {
        id: parsed.data.baleUser.id,
        username: parsed.data.baleUser.username ?? null,
        firstName: parsed.data.baleUser.firstName ?? null,
        lastName: parsed.data.baleUser.lastName ?? null,
        avatarUrl: parsed.data.baleUser.avatarUrl ?? null
      },
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      displayName: parsed.data.displayName ?? null,
      currentUserId: request.currentUser?.id ?? null,
      sessionContext: {
        ip: getRequestIp(request),
        userAgent: getRequestUserAgent(request)
      }
    });

    response.status(200).json({
      status: 'OK',
      provider: 'BALE',
      authenticated: true,
      token: result.token,
      user: result.user,
      session: result.session,
      authAccount: {
        id: result.authAccount.id,
        provider: result.authAccount.provider,
        providerAccountId: result.authAccount.providerAccountId
      },
      isNewUser: result.isNewUser,
      linkedAccount: true,
      isNewAuthAccount: result.isNewAuthAccount
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

export const getCurrentSubscription = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const access = await subscriptionService.resolveAccessForUser(user.id);

    response.json({
      status: 'OK',
      access
    });
  } catch (error) {
    next(error);
  }
};

export const activateTrialSubscription = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const access = await subscriptionService.activateTrial(user.id);

    response.status(201).json({
      status: 'OK',
      access
    });
  } catch (error) {
    next(error);
  }
};
