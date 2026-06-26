import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'development',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 60
  }
}));

import { rateLimit } from '../src/middleware/rateLimit';

describe('rateLimit middleware', () => {
  it('is bypassed in development', () => {
    const next = vi.fn();
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as never;

    rateLimit(
      {
        ip: '127.0.0.1'
      } as never,
      response,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
