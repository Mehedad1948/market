import os from 'node:os';

import axios from 'axios';

import { env } from '../config/env';
import { logger, maskSecret } from '../lib/logger';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 3500;

const isTelegramConfigured = () => {
  return (
    env.TELEGRAM_NOTIFICATIONS_ENABLED &&
    env.TELEGRAM_BOT_TOKEN.trim().length > 0 &&
    env.TELEGRAM_BOT_CHAT_ID.trim().length > 0
  );
};

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

export const telegramNotifier = {
  isConfigured() {
    return isTelegramConfigured();
  },

  async send(title: string, details?: Record<string, unknown>) {
    if (!isTelegramConfigured()) {
      logger.debug(
        {
          telegramNotificationsEnabled: env.TELEGRAM_NOTIFICATIONS_ENABLED,
          telegramBotTokenConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
          telegramBotChatIdConfigured: Boolean(env.TELEGRAM_BOT_CHAT_ID)
        },
        'Telegram notifier skipped because it is not fully configured'
      );
      return false;
    }

    const text = buildMessage(title, details);

    try {
      await axios.post(
        `${TELEGRAM_API_BASE_URL}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: env.TELEGRAM_BOT_CHAT_ID,
          text
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
          telegramNotificationsEnabled: env.TELEGRAM_NOTIFICATIONS_ENABLED,
          telegramBotTokenPreview: maskSecret(env.TELEGRAM_BOT_TOKEN),
          telegramBotChatIdConfigured: Boolean(env.TELEGRAM_BOT_CHAT_ID),
          attemptedTitle: title
        },
        'Telegram notification failed'
      );

      return false;
    }
  }
};
