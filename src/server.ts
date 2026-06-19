import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startSignalScanSchedule } from './services/signalScan.service';

const app = createApp();

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime()
  });
});

app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Server listening on port ${env.PORT}`);

  try {
    startSignalScanSchedule();
  } catch (error) {
    logger.error({ error }, 'Failed to start signal scan schedule');
  }
});