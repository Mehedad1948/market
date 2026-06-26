import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  BRS_API_KEY: 'test-brs-key',
  BRS_BASE_URL: 'https://example.com'
};

describe('env parser', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('parses MAILTRAP_SECURE=false as false', async () => {
    vi.stubEnv(baseEnv);
    vi.stubEnv('MAILTRAP_HOST', 'sandbox.smtp.mailtrap.io');
    vi.stubEnv('MAILTRAP_PORT', '587');
    vi.stubEnv('MAILTRAP_USER', 'mailtrap-user');
    vi.stubEnv('MAILTRAP_PASS', 'mailtrap-pass');
    vi.stubEnv('MAILTRAP_SECURE', 'false');
    vi.stubEnv('MAILTRAP_FROM_EMAIL', 'auth@example.com');

    const { env } = await import('../src/config/env');

    expect(env.MAILTRAP_SECURE).toBe(false);
  });
});
