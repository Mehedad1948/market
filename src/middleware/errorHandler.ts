import type { NextFunction, Request, Response } from 'express';

import { BrsApiError } from '../services/brsClient';
import { InsufficientDataError } from '../services/analysis.service';
import { logger } from '../lib/logger';

export class AppError extends Error {
  statusCode: number;
  payload: Record<string, unknown> | undefined;

  constructor(message: string, statusCode = 500, payload?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export const notFoundHandler = (_request: Request, response: Response) => {
  response.status(404).json({
    status: 'ERROR',
    message: 'مسیر درخواستی یافت نشد.',
    englishMessage: 'Route not found'
  });
};

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  next: NextFunction
) => {
  void next;
  logger.error({ err: error }, 'Unhandled error');

  if (error instanceof BrsApiError) {
    response.status(502).json({
      status: 'ERROR',
      message: 'خطا در دریافت داده از BrsApi',
      englishMessage: 'Failed to fetch data from BrsApi'
    });
    return;
  }

  if (error instanceof InsufficientDataError) {
    response.status(200).json({
      status: 'INSUFFICIENT_DATA',
      persianSummary: 'برای محاسبه میانگین فصلی، تعداد داده‌های تاریخی کافی نیست.'
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      status: 'ERROR',
      message: error.message,
      ...error.payload
    });
    return;
  }

  response.status(500).json({
    status: 'ERROR',
    message: 'خطای داخلی سرور',
    englishMessage: 'Internal server error'
  });
};
