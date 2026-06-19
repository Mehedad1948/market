import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startSignalScanSchedule } from './services/signalScan.service';

const app = createApp();

startSignalScanSchedule();

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});
