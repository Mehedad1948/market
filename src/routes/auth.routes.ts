import { Router } from 'express';

import {
  activateTrialSubscription,
  authenticateWithBale,
  authenticateWithGoogle,
  authenticateWithTelegram,
  getCurrentSubscription,
  getCurrentAuth,
  logoutCurrentSession,
  requestEmailOtp,
  verifyEmailOtp
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/me', getCurrentAuth);
authRouter.get('/subscription', getCurrentSubscription);
authRouter.post('/email/request-otp', requestEmailOtp);
authRouter.post('/email/verify-otp', verifyEmailOtp);
authRouter.post('/bale/callback', authenticateWithBale);
authRouter.post('/telegram/callback', authenticateWithTelegram);
authRouter.post('/google/callback', authenticateWithGoogle);
authRouter.post('/logout', logoutCurrentSession);
authRouter.post('/subscription/trial', activateTrialSubscription);
