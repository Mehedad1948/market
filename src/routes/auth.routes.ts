import { Router } from 'express';

import {
  activateTrialSubscription,
  authenticateWithBale,
  getCurrentSubscription,
  getCurrentAuth,
  logoutCurrentSession
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/me', getCurrentAuth);
authRouter.get('/subscription', getCurrentSubscription);
authRouter.post('/bale/callback', authenticateWithBale);
authRouter.post('/logout', logoutCurrentSession);
authRouter.post('/subscription/trial', activateTrialSubscription);
