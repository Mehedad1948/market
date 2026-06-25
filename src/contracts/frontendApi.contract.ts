export type FrontendEndpointContract = {
  operationId: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  summary: string;
  auth: 'bearer';
  requestBodyType?: string;
  responseBodyType: string;
  successStatus: 200 | 201;
  errorStatuses: number[];
  notes?: string[];
};

export const frontendEndpointContracts: FrontendEndpointContract[] = [
  {
    operationId: 'listWatchlist',
    method: 'GET',
    path: '/api/watchlist',
    summary: 'List the authenticated user watchlist.',
    auth: 'bearer',
    responseBodyType: 'ListWatchlistResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'addWatchlistSymbol',
    method: 'POST',
    path: '/api/watchlist',
    summary: 'Add a symbol to the authenticated user watchlist.',
    auth: 'bearer',
    requestBodyType: 'AddWatchlistSymbolRequest',
    responseBodyType: 'AddWatchlistSymbolResponse',
    successStatus: 201,
    errorStatuses: [400, 401, 403, 409],
    notes: ['The backend normalizes the symbol to uppercase before persisting it.']
  },
  {
    operationId: 'removeWatchlistSymbol',
    method: 'DELETE',
    path: '/api/watchlist/{symbol}',
    summary: 'Remove a symbol from the authenticated user watchlist.',
    auth: 'bearer',
    responseBodyType: 'RemoveWatchlistSymbolResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404],
    notes: ['The route parameter may be sent in any casing.']
  },
  {
    operationId: 'listAlertRules',
    method: 'GET',
    path: '/api/alerts/rules',
    summary: 'List the authenticated user alert rules.',
    auth: 'bearer',
    responseBodyType: 'ListAlertRulesResponse',
    successStatus: 200,
    errorStatuses: [401]
  },
  {
    operationId: 'createAlertRule',
    method: 'POST',
    path: '/api/alerts/rules',
    summary: 'Create an alert rule for the authenticated user.',
    auth: 'bearer',
    requestBodyType: 'CreateAlertRuleRequest',
    responseBodyType: 'CreateAlertRuleResponse',
    successStatus: 201,
    errorStatuses: [400, 401],
    notes: [
      'Use `type=SIGNAL_ACTION` with `signalAction`.',
      'Use `type=SIGNAL_SCORE` with `minScore`.',
      'Use `type=WATCHLIST_CHANGE` with `watchlistChangeEvent`.'
    ]
  },
  {
    operationId: 'deleteAlertRule',
    method: 'DELETE',
    path: '/api/alerts/rules/{id}',
    summary: 'Delete an alert rule owned by the authenticated user.',
    auth: 'bearer',
    responseBodyType: 'DeleteAlertRuleResponse',
    successStatus: 200,
    errorStatuses: [400, 401, 404]
  }
];

export const frontendApiOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Market Frontend Integration Contract',
    version: '2026-06-25.1',
    description:
      'Machine-readable contract for watchlist and alert endpoints intended for frontend integrations and Codex agents.'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development'
    }
  ],
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/api/watchlist': {
      get: {
        operationId: 'listWatchlist',
        tags: ['watchlist'],
        summary: 'List the authenticated user watchlist.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Watchlist items returned successfully.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ListWatchlistResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      post: {
        operationId: 'addWatchlistSymbol',
        tags: ['watchlist'],
        summary: 'Add a symbol to the authenticated user watchlist.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddWatchlistSymbolRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'The symbol was added to the watchlist.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddWatchlistSymbolResponse' }
              }
            }
          },
          '400': {
            description: 'The request body is invalid.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '403': {
            description: 'The user watchlist limit has been reached.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '409': {
            description: 'The symbol already exists in the watchlist.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/watchlist/{symbol}': {
      delete: {
        operationId: 'removeWatchlistSymbol',
        tags: ['watchlist'],
        summary: 'Remove a symbol from the authenticated user watchlist.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              minLength: 1
            }
          }
        ],
        responses: {
          '200': {
            description: 'The symbol was removed from the watchlist.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RemoveWatchlistSymbolResponse'
                }
              }
            }
          },
          '400': {
            description: 'The symbol path parameter is invalid.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '404': {
            description: 'The symbol was not found in the watchlist.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/alerts/rules': {
      get: {
        operationId: 'listAlertRules',
        tags: ['alerts'],
        summary: 'List the authenticated user alert rules.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Alert rules returned successfully.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ListAlertRulesResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createAlertRule',
        tags: ['alerts'],
        summary: 'Create an alert rule for the authenticated user.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAlertRuleRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'The alert rule was created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateAlertRuleResponse' }
              }
            }
          },
          '400': {
            description: 'The request body is invalid.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/alerts/rules/{id}': {
      delete: {
        operationId: 'deleteAlertRule',
        tags: ['alerts'],
        summary: 'Delete an alert rule owned by the authenticated user.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              minLength: 1
            }
          }
        ],
        responses: {
          '200': {
            description: 'The alert rule was deleted.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeleteAlertRuleResponse' }
              }
            }
          },
          '400': {
            description: 'The path parameter is invalid.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Authentication required.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '404': {
            description: 'The alert rule was not found.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Bearer session token'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['status', 'message'],
        properties: {
          status: { type: 'string', enum: ['ERROR'] },
          message: { type: 'string' },
          englishMessage: { type: 'string' },
          issues: { type: 'object', additionalProperties: true },
          limit: { type: 'integer' },
          accessLevel: { type: 'string' }
        },
        additionalProperties: true
      },
      WatchlistItem: {
        type: 'object',
        required: ['id', 'symbol', 'createdAt'],
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AddWatchlistSymbolRequest: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', minLength: 1 }
        },
        additionalProperties: false
      },
      ListWatchlistResponse: {
        type: 'object',
        required: ['status', 'items'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/WatchlistItem' }
          }
        }
      },
      AddWatchlistSymbolResponse: {
        type: 'object',
        required: ['status', 'item'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          item: { $ref: '#/components/schemas/WatchlistItem' }
        }
      },
      RemoveWatchlistSymbolResponse: {
        type: 'object',
        required: ['status', 'removed'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          removed: {
            type: 'object',
            required: ['symbol'],
            properties: {
              symbol: { type: 'string' }
            }
          }
        }
      },
      AlertRule: {
        type: 'object',
        required: [
          'id',
          'type',
          'scope',
          'symbol',
          'signalAction',
          'minScore',
          'watchlistChangeEvent',
          'enabled',
          'cooldownMinutes',
          'createdAt',
          'updatedAt'
        ],
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['SIGNAL_ACTION', 'SIGNAL_SCORE', 'WATCHLIST_CHANGE']
          },
          scope: {
            type: 'string',
            enum: ['ALL_WATCHLIST', 'SYMBOL']
          },
          symbol: { type: ['string', 'null'] },
          signalAction: { type: ['string', 'null'] },
          minScore: { type: ['integer', 'null'] },
          watchlistChangeEvent: {
            type: ['string', 'null'],
            enum: ['ADDED', 'REMOVED', null]
          },
          enabled: { type: 'boolean' },
          cooldownMinutes: { type: 'integer', minimum: 0, maximum: 10080 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateAlertRuleRequest: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['SIGNAL_ACTION', 'SIGNAL_SCORE', 'WATCHLIST_CHANGE']
          },
          scope: {
            type: 'string',
            enum: ['ALL_WATCHLIST', 'SYMBOL']
          },
          symbol: { type: ['string', 'null'], minLength: 1 },
          signalAction: { type: ['string', 'null'], minLength: 1 },
          minScore: { type: ['integer', 'null'] },
          watchlistChangeEvent: {
            type: ['string', 'null'],
            enum: ['ADDED', 'REMOVED', null]
          },
          enabled: { type: 'boolean' },
          cooldownMinutes: { type: 'integer', minimum: 0, maximum: 10080 }
        },
        additionalProperties: false
      },
      ListAlertRulesResponse: {
        type: 'object',
        required: ['status', 'rules'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          rules: {
            type: 'array',
            items: { $ref: '#/components/schemas/AlertRule' }
          }
        }
      },
      CreateAlertRuleResponse: {
        type: 'object',
        required: ['status', 'rule'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          rule: { $ref: '#/components/schemas/AlertRule' }
        }
      },
      DeleteAlertRuleResponse: {
        type: 'object',
        required: ['status', 'removed'],
        properties: {
          status: { type: 'string', enum: ['OK'] },
          removed: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          }
        }
      }
    }
  }
} as const;

export const frontendApiTypesSource = `export type ErrorResponse = {
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
`;
