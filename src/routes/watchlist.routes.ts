import { Router } from 'express';

import {
  addWatchlistSymbol,
  listWatchlist,
  removeWatchlistSymbol
} from '../controllers/watchlist.controller';

export const watchlistRouter = Router();

watchlistRouter.get('/', listWatchlist);
watchlistRouter.post('/', addWatchlistSymbol);
watchlistRouter.delete('/:symbol', removeWatchlistSymbol);
