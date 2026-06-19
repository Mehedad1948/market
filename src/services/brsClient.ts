import axios, { AxiosError } from 'axios';

import { env } from '../config/env';
import { logger, maskSecret } from '../lib/logger';
import type { BrsHistoryTradeRow, BrsRealLegalRow } from '../types';

export class BrsApiError extends Error {
  details: Record<string, unknown> | undefined;

  constructor(
    message = 'Failed to fetch data from BrsApi',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BrsApiError';
    this.details = details;
  }
}

const client = axios.create({
  baseURL: env.BRS_BASE_URL,
  timeout: 20000
});

const summarizePayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return {
      kind: 'array',
      length: payload.length
    };
  }

  if (payload && typeof payload === 'object') {
    return {
      kind: 'object',
      keys: Object.keys(payload as Record<string, unknown>).slice(0, 10)
    };
  }

  return {
    kind: typeof payload,
    valuePreview:
      typeof payload === 'string' ? payload.slice(0, 200) : String(payload)
  };
};

const normalizeArrayResponse = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    const candidate = objectPayload.data ?? objectPayload.result ?? objectPayload.items;
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return [];
};

const fetchHistory = async <T>(symbol: string, type: 0 | 1): Promise<T[]> => {
  const startedAt = Date.now();
  const endpoint = '/History.php';
  const requestMeta = {
    symbol,
    type,
    endpoint,
    baseURL: env.BRS_BASE_URL,
    timeoutMs: client.defaults.timeout,
    apiKeyConfigured: Boolean(env.BRS_API_KEY),
    apiKeyPreview: maskSecret(env.BRS_API_KEY)
  };

  try {
    logger.info(
      { ...requestMeta },
      '🌐 BrsApi request started'
    );

    const response = await client.get('/History.php', {
      params: {
        key: env.BRS_API_KEY,
        type,
        l18: symbol
      }
    });

    const normalized = normalizeArrayResponse<T>(response.data);
    const durationMs = Date.now() - startedAt;

    logger.info(
      {
        ...requestMeta,
        durationMs,
        httpStatus: response.status,
        responseSummary: summarizePayload(response.data),
        normalizedRowCount: normalized.length
      },
      normalized.length > 0
        ? '✅ BrsApi request succeeded'
        : '⚠️ BrsApi request returned zero normalized rows'
    );

    return normalized;
  } catch (error) {
    if (error instanceof AxiosError) {
      const details = {
        ...requestMeta,
        durationMs: Date.now() - startedAt,
        axiosCode: error.code,
        httpStatus: error.response?.status ?? null,
        statusText: error.response?.statusText ?? null,
        responseSummary: summarizePayload(error.response?.data),
        message: error.message
      };

      logger.error(
        { err: error, ...details },
        '🚨 BrsApi request failed'
      );

      throw new BrsApiError(error.message, details);
    }

    logger.error(
      {
        err: error,
        ...requestMeta,
        durationMs: Date.now() - startedAt
      },
      '🚨 Unexpected BrsApi client failure'
    );

    throw new BrsApiError('Failed to fetch data from BrsApi', requestMeta);
  }
};

export const brsClient = {
  fetchTradeHistory: (symbol: string) => fetchHistory<BrsHistoryTradeRow>(symbol, 0),
  fetchRealLegalHistory: (symbol: string) => fetchHistory<BrsRealLegalRow>(symbol, 1)
};
