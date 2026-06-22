import type { NextFunction, Request, Response } from 'express';

import { BrsApiError } from '../services/brsClient';
import { InsufficientDataError } from '../services/analysis.service';
import { logger } from '../lib/logger';
import { telegramNotifier } from '../services/telegramNotifier.service';

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
  request: Request,
  response: Response,
  next: NextFunction
) => {
  void next;
  const requestContext = {
    method: request.method,
    url: request.originalUrl,
    params: request.params,
    query: request.query,
    ip: request.ip
  };

  if (error instanceof BrsApiError) {
    logger.error(
      {
        err: error,
        request: requestContext,
        brs: error.details
      },
      '🚨 BrsApi error reached HTTP boundary'
    );
    response.status(502).json({
      status: 'ERROR',
      message: 'خطا در دریافت داده از BrsApi',
      englishMessage: 'Failed to fetch data from BrsApi'
    });
    return;
  }

  if (error instanceof InsufficientDataError) {
    logger.warn(
      { err: error, request: requestContext },
      'ℹ️ Insufficient data response returned'
    );
    response.status(200).json({
      status: 'INSUFFICIENT_DATA',
      persianSummary: 'برای محاسبه میانگین فصلی، تعداد داده‌های تاریخی کافی نیست.'
    });
    return;
  }

  if (error instanceof AppError) {
    logger.warn(
      {
        err: error,
        request: requestContext,
        payload: error.payload
      },
      '⚠️ App error returned to client'
    );
    response.status(error.statusCode).json({
      status: 'ERROR',
      message: error.message,
      ...error.payload
    });
    return;
  }

  logger.error(
    { err: error, request: requestContext },
    '💥 Unhandled internal server error'
  );

  void telegramNotifier.send('Unhandled internal server error', {
    message: error.message,
    name: error.name,
    request: requestContext
  });

  response.status(500).json({
    status: 'ERROR',
    message: 'خطای داخلی سرور',
    englishMessage: 'Internal server error'
  });
};
