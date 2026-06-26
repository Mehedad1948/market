import nodemailer from 'nodemailer';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const createTransport = () => {
  if (
    !env.MAILTRAP_HOST.trim() ||
    !env.MAILTRAP_USER.trim() ||
    !env.MAILTRAP_PASS.trim() ||
    !env.MAILTRAP_FROM_EMAIL.trim()
  ) {
    throw new AppError('Email OTP is not configured', 500, {
      englishMessage: 'Email OTP is not configured'
    });
  }

  return nodemailer.createTransport({
    host: env.MAILTRAP_HOST,
    port: env.MAILTRAP_PORT,
    secure: env.MAILTRAP_SECURE,
    auth: {
      user: env.MAILTRAP_USER,
      pass: env.MAILTRAP_PASS
    }
  });
};

export const emailAuthNotifier = {
  async sendLoginOtp(input: { email: string; code: string; expiresAt: Date }) {
    const transport = createTransport();
    const expiresAtText = input.expiresAt.toISOString();

    try {
      return await transport.sendMail({
        from: `"${env.MAILTRAP_FROM_NAME}" <${env.MAILTRAP_FROM_EMAIL}>`,
        to: input.email,
        subject: 'Your login code',
        html: [
          '<div style="font-family:Arial,sans-serif;line-height:1.6">',
          '<h2>Login code</h2>',
          `<p>Your one-time login code is <strong>${input.code}</strong>.</p>`,
          `<p>This code expires at <strong>${expiresAtText}</strong>.</p>`,
          '<p>If you did not request this code, you can ignore this email.</p>',
          '</div>'
        ].join('')
      });
    } catch (error) {
      throw new AppError('Failed to send email OTP', 502, {
        englishMessage: 'Failed to send email OTP',
        provider: 'MAILTRAP',
        cause: error instanceof Error ? error.message : 'Unknown mail transport error'
      });
    }
  }
};
