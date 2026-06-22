import type { Request, Response } from 'express';

import { logger } from '../lib/logger';
import { telegramNotifier } from '../services/telegramNotifier.service';

export const sendTelegramTestNotification = async (
  request: Request,
  response: Response
) => {
  const sent = await telegramNotifier.send('Test notification', {
    source: 'manual_test_endpoint',
    path: request.originalUrl,
    method: request.method
  });

  (request.log ?? logger).info(
    {
      sent,
      telegramConfigured: telegramNotifier.isConfigured()
    },
    'Telegram test notification requested'
  );

  response.json({
    status: sent ? 'OK' : 'ERROR',
    sent,
    telegramConfigured: telegramNotifier.isConfigured()
  });
};
