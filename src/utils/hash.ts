import crypto from 'node:crypto';

export const createHash = (input: unknown): string => {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
};
