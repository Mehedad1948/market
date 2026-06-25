export type ErrorResponse = {
  status: 'ERROR';
  message: string;
  englishMessage?: string;
  issues?: unknown;
  limit?: number;
  accessLevel?: string;
  [key: string]: unknown;
};

export type WatchlistItem = {
  id: string;
  symbol: string;
  createdAt: string;
};

export type AddWatchlistSymbolRequest = {
  symbol: string;
};

export type ListWatchlistResponse = {
  status: 'OK';
  items: WatchlistItem[];
};

export type AddWatchlistSymbolResponse = {
  status: 'OK';
  item: WatchlistItem;
};

export type RemoveWatchlistSymbolResponse = {
  status: 'OK';
  removed: {
    symbol: string;
  };
};

export type AlertRuleType = 'SIGNAL_ACTION' | 'SIGNAL_SCORE' | 'WATCHLIST_CHANGE';
export type AlertRuleScope = 'ALL_WATCHLIST' | 'SYMBOL';
export type WatchlistChangeEvent = 'ADDED' | 'REMOVED';

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  scope: AlertRuleScope;
  symbol: string | null;
  signalAction: string | null;
  minScore: number | null;
  watchlistChangeEvent: WatchlistChangeEvent | null;
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAlertRuleRequest = {
  type: AlertRuleType;
  scope?: AlertRuleScope;
  symbol?: string | null;
  signalAction?: string | null;
  minScore?: number | null;
  watchlistChangeEvent?: WatchlistChangeEvent | null;
  enabled?: boolean;
  cooldownMinutes?: number;
};

export type ListAlertRulesResponse = {
  status: 'OK';
  rules: AlertRule[];
};

export type CreateAlertRuleResponse = {
  status: 'OK';
  rule: AlertRule;
};

export type DeleteAlertRuleResponse = {
  status: 'OK';
  removed: {
    id: string;
  };
};
