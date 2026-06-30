import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
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

const telegramCallbackBodySchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1).optional().nullable(),
  username: z.string().trim().min(1).optional().nullable(),
  photo_url: z.string().trim().url().optional().nullable(),
  auth_date: z.union([z.string(), z.number()]).transform((value) => Number(value)),
  hash: z.string().trim().min(1)
});

const googleCallbackBodySchema = z.object({
  idToken: z.string().trim().min(1),
  nonce: z.string().trim().min(1).optional().nullable()
});

const emailOtpRequestBodySchema = z.object({
  email: z.string().trim().email()
});

const emailOtpVerifyBodySchema = z.object({
  email: z.string().trim().email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/),
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
    throw new AppError('ØªÙˆÚ©Ù† Ø§Ø­Ø±Ø§Ø² Ù‡ÙˆÛŒØª Ø¨Ù„Ù‡ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
      englishMessage: 'Invalid Bale bot token'
    });
  }
};

const assertGoogleAuthConfigured = () => {
  if (!env.GOOGLE_CLIENT_ID.trim()) {
    throw new AppError('ÙˆØ±ÙˆØ¯ Ú¯ÙˆÚ¯Ù„ Ø¯Ø± Ø³Ø±ÙˆØ± Ù¾ÛŒÚ©Ø±Ø¨Ù†Ø¯ÛŒ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.', 500, {
      englishMessage: 'Google auth is not configured'
    });
  }
};

const assertTelegramAuthConfigured = () => {
  if (!env.TELEGRAM_BOT_TOKEN.trim()) {
    throw new AppError('ÙˆØ±ÙˆØ¯ ØªÙ„Ú¯Ø±Ø§Ù… Ø¯Ø± Ø³Ø±ÙˆØ± Ù¾ÛŒÚ©Ø±Ø¨Ù†Ø¯ÛŒ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.', 500, {
      englishMessage: 'Telegram auth is not configured'
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

export const authenticateWithTelegram = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    assertTelegramAuthConfigured();

    const parsed = telegramCallbackBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست احراز هویت تلگرام معتبر نیست.', 400, {
        englishMessage: 'Invalid Telegram auth payload',
        issues: parsed.error.flatten()
      });
    }

    const result = await authService.authenticateWithTelegram({
      telegramUser: {
        id: parsed.data.id,
        firstName: parsed.data.first_name,
        lastName: parsed.data.last_name ?? null,
        username: parsed.data.username ?? null,
        photoUrl: parsed.data.photo_url ?? null,
        authDate: parsed.data.auth_date,
        hash: parsed.data.hash
      },
      currentUserId: request.currentUser?.id ?? null,
      sessionContext: {
        ip: getRequestIp(request),
        userAgent: getRequestUserAgent(request)
      }
    });

    response.status(200).json({
      status: 'OK',
      provider: 'TELEGRAM',
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

export const authenticateWithGoogle = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    assertGoogleAuthConfigured();

    const parsed = googleCallbackBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست احراز هویت گوگل معتبر نیست.', 400, {
        englishMessage: 'Invalid Google auth payload',
        issues: parsed.error.flatten()
      });
    }

    const result = await authService.authenticateWithGoogle({
      idToken: parsed.data.idToken,
      nonce: parsed.data.nonce ?? null,
      currentUserId: request.currentUser?.id ?? null,
      sessionContext: {
        ip: getRequestIp(request),
        userAgent: getRequestUserAgent(request)
      }
    });

    response.status(200).json({
      status: 'OK',
      provider: 'GOOGLE',
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

export const requestEmailOtp = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const parsed = emailOtpRequestBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست کد ورود ایمیل معتبر نیست.', 400, {
        englishMessage: 'Invalid email OTP request payload',
        issues: parsed.error.flatten()
      });
    }

    const result = await authService.requestEmailLoginOtp({
      email: parsed.data.email
    });

    response.status(200).json({
      status: 'OK',
      channel: 'EMAIL',
      email: result.email,
      otpCode: result.otpCode,
      expiresAt: result.expiresAt,
      retryAfterSeconds: result.retryAfterSeconds
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmailOtp = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const parsed = emailOtpVerifyBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست تایید کد ایمیل معتبر نیست.', 400, {
        englishMessage: 'Invalid email OTP verification payload',
        issues: parsed.error.flatten()
      });
    }

    const result = await authService.verifyEmailLoginOtp({
      email: parsed.data.email,
      code: parsed.data.code,
      displayName: parsed.data.displayName ?? null,
      currentUserId: request.currentUser?.id ?? null,
      sessionContext: {
        ip: getRequestIp(request),
        userAgent: getRequestUserAgent(request)
      }
    });

    response.status(200).json({
      status: 'OK',
      provider: 'EMAIL',
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
      throw new AppError('Ù†Ø´Ø³Øª Ú©Ø§Ø±Ø¨Ø± Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.', 401, {
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


