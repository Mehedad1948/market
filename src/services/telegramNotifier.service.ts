import os from 'node:os';

import axios from 'axios';

import { env } from '../config/env';
import { logger, maskSecret } from '../lib/logger';

const BALE_BOT_API_BASE_URL = 'https://tapi.bale.ai';
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

const sendMessage = async (
  message: string,
  chatId: string | null | undefined
): Promise<boolean> => {
  if (env.NODE_ENV !== 'production') {
    logger.info(
      {
        nodeEnv: env.NODE_ENV
      },
      'Bale notifier skipped outside production environment'
    );

    return false;
  }

  if (!env.BALE_BOT_TOKEN.trim() || !chatId?.trim()) {
    logger.warn(
      {
        baleBotTokenConfigured: Boolean(env.BALE_BOT_TOKEN),
        baleBotChatIdConfigured: Boolean(chatId)
      },
      'Bale notifier skipped because it is not fully configured'
    );

    return false;
  }

  try {
    await axios.post(
      `${BALE_BOT_API_BASE_URL}/bot${env.BALE_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: message
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
        endpoint: `${BALE_BOT_API_BASE_URL}/bot${maskSecret(env.BALE_BOT_TOKEN)}/sendMessage`,
        baleBotChatIdConfigured: Boolean(chatId),
        messagePreview: message.slice(0, 200)
      },
      'Bale notification request failed'
    );

    return false;
  }
};

export const telegramNotifier = {
  isConfigured() {
    return Boolean(env.BALE_BOT_TOKEN.trim() && env.BALE_BOT_CHAT_ID.trim());
  },

  async send(title: string, details?: Record<string, unknown>) {
    return sendMessage(buildMessage(title, details), env.BALE_BOT_CHAT_ID);
  },

  async sendToChat(
    chatId: string,
    title: string,
    details?: Record<string, unknown>
  ) {
    return sendMessage(buildMessage(title, details), chatId);
  }
};
