import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { requireAuthenticatedUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { portfolioService } from '../services/portfolio.service';

const portfolioCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional()
});

const portfolioRenameBodySchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const holdingCreateBodySchema = z.object({
  symbol: z.string().trim().min(1).max(64),
  quantity: z.number().positive(),
  averageBuyPrice: z.number().positive().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

const holdingUpdateBodySchema = z.object({
  quantity: z.number().positive(),
  averageBuyPrice: z.number().positive().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

const getRouteValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

export const listPortfolios = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolios = await portfolioService.listPortfolios(user.id);

    response.json({
      status: 'OK',
      portfolios
    });
  } catch (error) {
    next(error);
  }
};

export const getPortfolio = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    if (!portfolioId) {
      throw new AppError('شناسه سبد سرمایه‌گذاری الزامی است.', 400, {
        englishMessage: 'Portfolio id is required'
      });
    }

    const portfolio = await portfolioService.getPortfolio(user.id, portfolioId);
    response.json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};

export const createPortfolio = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const parsed = portfolioCreateBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست سبد سرمایه‌گذاری معتبر نیست.', 400, {
        englishMessage: 'Invalid portfolio payload',
        issues: parsed.error.flatten()
      });
    }

    const portfolio = await portfolioService.createPortfolio(
      user.id,
      parsed.data.name
    );
    response.status(201).json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};

export const renamePortfolio = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    const parsed = portfolioRenameBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست تغییر نام سبد معتبر نیست.', 400, {
        englishMessage: 'Invalid portfolio rename payload',
        issues: parsed.error.flatten()
      });
    }

    const portfolio = await portfolioService.renamePortfolio(
      user.id,
      portfolioId,
      parsed.data.name
    );
    response.json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};

export const deletePortfolio = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    if (!portfolioId) {
      throw new AppError('شناسه سبد سرمایه‌گذاری الزامی است.', 400, {
        englishMessage: 'Portfolio id is required'
      });
    }

    const removed = await portfolioService.deletePortfolio(user.id, portfolioId);
    response.json({
      status: 'OK',
      removed
    });
  } catch (error) {
    next(error);
  }
};

export const addPortfolioHolding = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    const parsed = holdingCreateBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست دارایی سبد معتبر نیست.', 400, {
        englishMessage: 'Invalid portfolio holding payload',
        issues: parsed.error.flatten()
      });
    }

    const portfolio = await portfolioService.addHolding(user.id, portfolioId, {
      symbol: parsed.data.symbol,
      quantity: parsed.data.quantity,
      ...(parsed.data.averageBuyPrice !== undefined
        ? { averageBuyPrice: parsed.data.averageBuyPrice }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {})
    });
    response.status(201).json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioHolding = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    const symbol = getRouteValue(request.params.symbol);
    const parsed = holdingUpdateBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError('درخواست به‌روزرسانی دارایی سبد معتبر نیست.', 400, {
        englishMessage: 'Invalid portfolio holding update payload',
        issues: parsed.error.flatten()
      });
    }

    const portfolio = await portfolioService.updateHolding(
      user.id,
      portfolioId,
      symbol,
      {
        quantity: parsed.data.quantity,
        ...(parsed.data.averageBuyPrice !== undefined
          ? { averageBuyPrice: parsed.data.averageBuyPrice }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {})
      }
    );
    response.json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};

export const removePortfolioHolding = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const user = requireAuthenticatedUser(request);
    const portfolioId = getRouteValue(request.params.portfolioId);
    const symbol = getRouteValue(request.params.symbol);
    const portfolio = await portfolioService.removeHolding(user.id, portfolioId, symbol);

    response.json({
      status: 'OK',
      portfolio
    });
  } catch (error) {
    next(error);
  }
};
