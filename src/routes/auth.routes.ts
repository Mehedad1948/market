import { Router } from 'express';

import {
  authenticateWithBale,
  getCurrentAuth,
  logoutCurrentSession
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/me', getCurrentAuth);
authRouter.post('/bale/callback', authenticateWithBale);
authRouter.post('/logout', logoutCurrentSession);
