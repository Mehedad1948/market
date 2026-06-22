import { Router } from 'express';

import { sendTelegramTestNotification } from '../controllers/notification.controller';

export const notificationRouter = Router();

notificationRouter.post('/telegram/test', sendTelegramTestNotification);
