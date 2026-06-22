import express from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

import { logger } from './lib/logger';
import { healthRouter } from './routes/health.routes';
import { rootRouter } from './routes/root.routes';
import { authRouter } from './routes/auth.routes';
import { notificationRouter } from './routes/notification.routes';
import { symbolCatalogRouter } from './routes/symbolCatalog.routes';
import { stockRouter } from './routes/stock.routes';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const existing = request.headers['x-request-id'];
        const firstHeaderValue = Array.isArray(existing) ? existing[0] : existing;
        const requestId = firstHeaderValue ?? randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      customReceivedMessage: () => '➡️ Request received',
      customSuccessMessage: (_request, response) => {
        if (response.statusCode >= 500) {
          return '❌ Request failed';
        }

        if (response.statusCode >= 400) {
          return '⚠️ Request completed with client error';
        }

        return '✅ Request completed';
      },
      customErrorMessage: () => '💥 Request pipeline crashed'
    })
  );
  app.use(rateLimit);
  app.use(authMiddleware);

  app.use(rootRouter);
  app.use(healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/symbols', symbolCatalogRouter);
  app.use('/api/stocks', stockRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
