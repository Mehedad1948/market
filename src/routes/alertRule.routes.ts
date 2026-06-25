import { Router } from 'express';

import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules
} from '../controllers/alertRule.controller';

export const alertRuleRouter = Router();

alertRuleRouter.get('/rules', listAlertRules);
alertRuleRouter.post('/rules', createAlertRule);
alertRuleRouter.delete('/rules/:id', deleteAlertRule);
