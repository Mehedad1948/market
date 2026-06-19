import { createApp } from './app';
import { env } from './config/env';
import { buildEnvDiagnostics, logger } from './lib/logger';
import { startSignalScanSchedule } from './services/signalScan.service';

const app = createApp();

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime()
  });
});

app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(
    {
      env: buildEnvDiagnostics()
    },
    `🚀 Server listening on port ${env.PORT}`
  );

  try {
    startSignalScanSchedule();
  } catch (error) {
    logger.error({ err: error }, '🧨 Failed to start signal scan schedule');
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, '💥 Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, '💀 Uncaught exception');
});
