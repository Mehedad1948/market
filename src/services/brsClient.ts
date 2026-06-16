import axios, { AxiosError } from 'axios';

import { env } from '../config/env';
import type { BrsHistoryTradeRow, BrsRealLegalRow } from '../types';

export class BrsApiError extends Error {
  constructor(message = 'Failed to fetch data from BrsApi') {
    super(message);
    this.name = 'BrsApiError';
  }
}

const client = axios.create({
  baseURL: env.BRS_BASE_URL,
  timeout: 20000
});

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
  try {
    const response = await client.get('/History.php', {
      params: {
        key: env.BRS_API_KEY,
        type,
        l18: symbol
      }
    });

    return normalizeArrayResponse<T>(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new BrsApiError(error.message);
    }

    throw new BrsApiError();
  }
};

export const brsClient = {
  fetchTradeHistory: (symbol: string) => fetchHistory<BrsHistoryTradeRow>(symbol, 0),
  fetchRealLegalHistory: (symbol: string) => fetchHistory<BrsRealLegalRow>(symbol, 1)
};
