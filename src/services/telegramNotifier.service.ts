import os from 'node:os';

import axios from 'axios';

import { env } from '../config/env';
import { logger } from '../lib/logger';

const NOTIFICATION_RELAY_URL = 'https://bale-bot-green.vercel.app/api/telegram';
const MAX_MESSAGE_LENGTH = 3500;

const formatDetails = (details?: Record<string, unknown>) => {
  if (!details || Object.keys(details).length === 0) {
    return '';
  }

  const serialized = JSON.stringify(details, null, 2);
  const trimmed =
    serialized.length > MAX_MESSAGE_LENGTH
      ? `${serialized.slice(0, MAX_MESSAGE_LENGTH)}...`
      : serialized;

  return `\n\n${trimmed}`;
};

const buildMessage = (title: string, details?: Record<string, unknown>) => {
  return (
    [
      'market notifier',
      title,
      `env=${env.NODE_ENV}`,
      `host=${os.hostname()}`,
      `time=${new Date().toISOString()}`
    ].join('\n') + formatDetails(details)
  );
};

export const notifFunction = async (message: string): Promise<boolean> => {
  try {
    await axios.post(
      NOTIFICATION_RELAY_URL,
      {
        message
      },
      {
        timeout: 10000
      }
    );

    return true;
  } catch (error) {
    logger.error(
      {
        err: error,
        endpoint: NOTIFICATION_RELAY_URL,
        messagePreview: message.slice(0, 200)
      },
      'Notification relay request failed'
    );

    return false;
  }
};

export const telegramNotifier = {
  isConfigured() {
    return true;
  },

  async send(title: string, details?: Record<string, unknown>) {
    return notifFunction(buildMessage(title, details));
  }
};
