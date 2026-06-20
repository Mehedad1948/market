import { Router } from 'express';

import {
  getCurrentAuth,
  logoutCurrentSession
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/me', getCurrentAuth);
authRouter.post('/logout', logoutCurrentSession);
