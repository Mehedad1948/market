import { Router } from 'express';

import { previewDiscountCode } from '../controllers/discountCode.controller';

export const discountCodeRouter = Router();

discountCodeRouter.post('/preview', previewDiscountCode);
