import { Router } from 'express';

import { getStockAnalysis } from '../controllers/stock.controller';

export const publicStockRouter = Router();

publicStockRouter.get('/:symbol/analysis', getStockAnalysis);
