import { Router } from 'express';

import {
  addPortfolioHolding,
  createPortfolio,
  deletePortfolio,
  getPortfolio,
  listPortfolios,
  removePortfolioHolding,
  renamePortfolio,
  updatePortfolioHolding
} from '../controllers/portfolio.controller';

export const portfolioRouter = Router();

portfolioRouter.get('/', listPortfolios);
portfolioRouter.post('/', createPortfolio);
portfolioRouter.get('/:portfolioId', getPortfolio);
portfolioRouter.patch('/:portfolioId', renamePortfolio);
portfolioRouter.delete('/:portfolioId', deletePortfolio);
portfolioRouter.post('/:portfolioId/holdings', addPortfolioHolding);
portfolioRouter.put('/:portfolioId/holdings/:symbol', updatePortfolioHolding);
portfolioRouter.delete('/:portfolioId/holdings/:symbol', removePortfolioHolding);
