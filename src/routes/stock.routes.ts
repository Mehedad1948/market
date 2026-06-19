import { Router } from 'express';

import {
  getLatestStockMetric,
  getStockAnalysis,
  getStockHistory,
  runManualSignalScan,
  refreshStockHistory
} from '../controllers/stock.controller';

export const stockRouter = Router();

stockRouter.post('/scan', runManualSignalScan);
stockRouter.get('/:symbol/analysis', getStockAnalysis);
stockRouter.post('/:symbol/refresh', refreshStockHistory);
stockRouter.get('/:symbol/history', getStockHistory);
stockRouter.get('/:symbol/latest', getLatestStockMetric);
