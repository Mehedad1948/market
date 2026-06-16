import express from 'express';
import pinoHttp from 'pino-http';

import { logger } from './lib/logger';
import { healthRouter } from './routes/health.routes';
import { stockRouter } from './routes/stock.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    pinoHttp({
      logger
    })
  );
  app.use(rateLimit);

  app.use(healthRouter);
  app.use('/api/stocks', stockRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
