import { Router } from 'express';

import {
  compareBacktests,
  getBacktestReport,
  runBacktest
} from '../controllers/backtest.controller';
import {
  getLatestAnalyses,
  getSignalScanStatus,
  getLatestStockMetric,
  getStockAnalysis,
  getStockHistory,
  runManualSignalScan,
  refreshStockHistory
} from '../controllers/stock.controller';

export const stockRouter = Router();

stockRouter.post('/scan', runManualSignalScan);
stockRouter.get('/scan/status', getSignalScanStatus);
stockRouter.get('/analyses/latest', getLatestAnalyses);
stockRouter.post('/backtests/run', runBacktest);
stockRouter.post('/backtests/compare', compareBacktests);
stockRouter.get('/backtests/reports', getBacktestReport);
stockRouter.get('/:symbol/analysis', getStockAnalysis);
stockRouter.post('/:symbol/refresh', refreshStockHistory);
stockRouter.get('/:symbol/history', getStockHistory);
stockRouter.get('/:symbol/latest', getLatestStockMetric);
