import { Router } from 'express';

import {
  applyDiscountCode,
  createDiscountCode,
  updateDiscountCodeStatus
} from '../controllers/discountCode.controller';
import { requireInternalApiToken } from '../middleware/internalAuth';

export const adminDiscountCodeRouter = Router();

adminDiscountCodeRouter.use(requireInternalApiToken);
adminDiscountCodeRouter.post('/discount-codes', createDiscountCode);
adminDiscountCodeRouter.post('/discount-codes/apply', applyDiscountCode);
adminDiscountCodeRouter.post('/discount-codes/:id/status', updateDiscountCodeStatus);
