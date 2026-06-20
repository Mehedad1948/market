import { Router } from 'express';

import {
  getGroupedSymbols,
  importSymbols,
  searchSymbols
} from '../controllers/symbolCatalog.controller';

export const symbolCatalogRouter = Router();

symbolCatalogRouter.post('/import', importSymbols);
symbolCatalogRouter.get('/grouped', getGroupedSymbols);
symbolCatalogRouter.get('/search', searchSymbols);
