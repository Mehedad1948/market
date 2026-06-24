import fs from 'node:fs';
import path from 'node:path';

export type OutputFormat = 'json' | 'markdown';

export type TaskScope =
  | 'auth-bale-login'
  | 'subscription-plans'
  | 'discount-codes'
  | 'watchlist-alerts'
  | 'portfolio-layer';

type ScopeSpec = {
  id: TaskScope;
  title: string;
  summary: string;
  objective: string;
  repoContext: string[];
  implementationTargets: string[];
  acceptanceCriteria: string[];
  validatorChecks: string[];
  validationCommands: string[];
  promptFocus: string[];
};

export type TaskPacket = {
  generatedAt: string;
  purpose: 'codex-task-iteration';
  scope: TaskScope;
  title: string;
  summary: string;
  objective: string;
  prompt: string;
  validator: {
    checks: string[];
    commands: string[];
  };
  repoContext: string[];
  implementationTargets: string[];
  acceptanceCriteria: string[];
};

export const SCOPE_ORDER: TaskScope[] = [
  'auth-bale-login',
  'subscription-plans',
  'discount-codes',
  'watchlist-alerts',
  'portfolio-layer'
];

const COMMON_GUARDRAILS = [
  'Preserve existing Prisma models and build on top of current auth/session/subscription/watchlist/portfolio foundations.',
  'Prefer Express controller/service/repository patterns already used in src/.',
  'Add or update tests for routes and services affected by the task.',
  'Do not add frontend code. Keep the scope backend-only unless the task explicitly requires notification payload changes.',
  'Use Bale notification plumbing only where the repo already supports it instead of inventing a second notifier path.',
  'Keep migrations additive and avoid renaming existing tables unless there is a strong compatibility reason.'
];

const SCOPE_SPECS: Record<TaskScope, ScopeSpec> = {
  'auth-bale-login': {
    id: 'auth-bale-login',
    title: 'User Login System Authentication With Bale Bot',
    summary: 'Implement Bale-based user authentication on top of the current session and linked-account foundations.',
    objective:
      'Add a complete Bale login or Bale account-linking flow that creates or resolves a user, stores the linked auth account, and issues a normal session token compatible with the existing auth middleware.',
    repoContext: [
      'Prisma already has User, UserAuthAccount, UserSession, and OtpCode models.',
      'Bearer-token auth middleware and /api/auth/me and /api/auth/logout already exist.',
      'Bale notification plumbing exists in src/services/telegramNotifier.service.ts but login/provider flow is incomplete.',
      'MISSING_SERVICES.md explicitly calls out missing provider login flows.'
    ],
    implementationTargets: [
      'src/controllers/auth.controller.ts',
      'src/routes/auth.routes.ts',
      'src/services/auth.service.ts',
      'prisma/schema.prisma',
      'tests/auth.*.test.ts'
    ],
    acceptanceCriteria: [
      'A Bale-driven auth flow can create or resolve a user and persist a linked provider account.',
      'The flow issues a valid user session that works with the existing auth middleware.',
      'Duplicate Bale accounts do not create duplicate users.',
      'Tests cover success, invalid payload/token, and existing-user linking cases.'
    ],
    validatorChecks: [
      'Confirm there is a concrete Bale login or callback endpoint, not only notifier reuse.',
      'Confirm provider metadata is stored in UserAuthAccount and session issuance uses existing session primitives.',
      'Confirm route tests cover both first login and repeat login.',
      'Confirm /api/auth/me reflects the authenticated Bale-backed user.'
    ],
    validationCommands: [
      'npm test -- auth',
      'npm run build',
      'rg -n "Bale|UserAuthAccount|createSession|authRouter" src tests prisma'
    ],
    promptFocus: [
      'Reuse existing auth/session code instead of building a parallel auth subsystem.',
      'Be explicit about Bale provider identity mapping and account-linking rules.',
      'Keep the result API-first and testable without a frontend.'
    ]
  },
  'subscription-plans': {
    id: 'subscription-plans',
    title: 'User Subscription Plans With 2-Week Free Trial',
    summary:
      'Implement enforceable plan selection and active-subscription resolution, including a 14-day free trial path.',
    objective:
      'Turn the current plan and subscription schema into working product logic: resolve active plan access, prevent repeated trial abuse, and support a 14-day free-trial subscription flow.',
    repoContext: [
      'Prisma already has Plan and Subscription models, and User.trialUsed exists.',
      'Seed data already includes a trial-14d plan.',
      'MISSING_SERVICES.md calls out plan enforcement, quotas, and expired subscription handling as missing.',
      'README.md mentions seeded subscription plans including a 14-day trial plan.'
    ],
    implementationTargets: ['src/services', 'src/middleware', 'src/controllers', 'prisma/seed.ts', 'tests'],
    acceptanceCriteria: [
      'The code can resolve the effective user access level from subscriptions.',
      'A user can activate a 14-day trial only once.',
      'Expired subscriptions are not treated as active.',
      'Tests cover no-plan, active-trial, active-paid, expired, and reused-trial cases.'
    ],
    validatorChecks: [
      'Confirm trial activation consults User.trialUsed or equivalent persisted state.',
      'Confirm subscription status and endsAt are both considered when resolving access.',
      'Confirm the repo has middleware or service logic usable by protected APIs.',
      'Confirm the trial duration is exactly 14 days in runtime logic, not just seed text.'
    ],
    validationCommands: [
      'npm test',
      'npm run build',
      'rg -n "trialUsed|Subscription|Plan|quota|access" src tests prisma'
    ],
    promptFocus: [
      'Build the smallest enforceable subscription layer first: resolve active plan, activate trial, and expose access checks.',
      'Keep the 14-day trial consistent across seed data, runtime logic, and tests.',
      'Do not bundle payment-provider integration into this task.'
    ]
  },
  'discount-codes': {
    id: 'discount-codes',
    title: 'Discount Code Generating And Managing',
    summary:
      'Add a discount-code subsystem that can create, validate, and apply discount codes to subscription purchases.',
    objective:
      'Implement backend support for discount code creation, status management, validation rules, and application during subscription checkout or quote-building.',
    repoContext: [
      'MISSING_SERVICES.md explicitly lists discount code generation and applying as missing.',
      'Plan, Subscription, and PaymentTransaction models already exist and should be extended rather than replaced.',
      'There is currently no discount-code model or service in the repo.'
    ],
    implementationTargets: ['prisma/schema.prisma', 'src/controllers', 'src/routes', 'src/services', 'tests'],
    acceptanceCriteria: [
      'Admins or internal workflows can generate a discount code with bounded rules.',
      'Runtime logic can validate a code by status, date window, usage limits, and plan compatibility.',
      'The code can calculate discounted pricing without mutating historical plan prices.',
      'Tests cover valid, expired, disabled, exhausted, and incompatible-plan codes.'
    ],
    validatorChecks: [
      'Confirm the schema stores code status, value type, usage limits, and validity windows.',
      'Confirm price calculation is deterministic and keeps original plan pricing intact.',
      'Confirm the API exposes validation or preview behavior before final payment.',
      'Confirm tests include concurrency-safe or repeat-use edge cases where applicable.'
    ],
    validationCommands: [
      'npm test',
      'npm run build',
      'rg -n "discount|coupon|promo|PaymentTransaction|Plan" src tests prisma'
    ],
    promptFocus: [
      'Keep discount logic isolated from payment-provider integration.',
      'Model percentage and fixed-amount discounts cleanly.',
      'Prefer an internal/admin-safe API surface over speculative public endpoints.'
    ]
  },
  'watchlist-alerts': {
    id: 'watchlist-alerts',
    title: 'Per-User Watchlist With Alerts',
    summary:
      'Implement authenticated watchlist CRUD plus user-owned alert rules that can notify through existing Bale plumbing.',
    objective:
      'Add watchlist APIs, per-user watchlist ownership, alert-rule persistence, and scan-triggered Bale/notification delivery for watchlist changes or signal events.',
    repoContext: [
      'Prisma already has UserWatchlistItem and user ownership.',
      'MVP_PLAN.md and MISSING_SERVICES.md call out watchlists and alert rules as P0 product work.',
      'Bale notification plumbing already exists but alert-rule models and workflows are incomplete.',
      'Auth middleware already exists and should guard per-user routes.'
    ],
    implementationTargets: ['src/controllers', 'src/routes', 'src/services', 'prisma/schema.prisma', 'tests'],
    acceptanceCriteria: [
      'Authenticated users can add, remove, and list watchlist symbols.',
      'Watchlist additions are unique per user and enforce plan-based limits if that logic exists.',
      'Alert rules can be defined per user and tied to watchlist or signal conditions.',
      'A scan path can trigger Bale notifications without spamming duplicate alerts.'
    ],
    validatorChecks: [
      'Confirm watchlist APIs are authenticated and user-scoped.',
      'Confirm alert delivery is deduplicated or logged to avoid repeated identical sends.',
      'Confirm watchlist uniqueness is preserved at both schema and service layers.',
      'Confirm tests cover add/remove/list and at least one alert-trigger path.'
    ],
    validationCommands: [
      'npm test',
      'npm run build',
      'rg -n "watchlist|alert|notification|Bale|telegramNotifier|requireAuthenticatedUser" src tests prisma'
    ],
    promptFocus: [
      'Start with durable user-owned watchlist CRUD and a minimal alert-rule model.',
      'Reuse the current Bale notifier instead of adding another messaging abstraction.',
      'Keep the first alert path deterministic and testable, even if scan integration is partial.'
    ]
  },
  'portfolio-layer': {
    id: 'portfolio-layer',
    title: 'Portfolio Layer For User',
    summary:
      'Implement portfolio CRUD and holding-aware portfolio analysis using the existing Portfolio and PortfolioHolding schema foundations.',
    objective:
      'Add user portfolio APIs and service logic so each user can manage holdings and receive position-aware analysis outputs such as P/L, concentration, and holding-specific action guidance.',
    repoContext: [
      'Prisma already has Portfolio and PortfolioHolding models.',
      'MVP_PLAN.md defines portfolio-aware advice as MVP 4 and says to use the existing schema.',
      'MISSING_SERVICES.md lists portfolio CRUD and holding-specific advice as missing.'
    ],
    implementationTargets: ['src/controllers', 'src/routes', 'src/services', 'tests'],
    acceptanceCriteria: [
      'Authenticated users can create, rename, list, and delete portfolios.',
      'Authenticated users can add, update, and remove holdings in a portfolio.',
      'Service logic can compute at least current holdings state, simple P/L inputs, and concentration metrics.',
      'Tests cover user scoping and holding uniqueness within a portfolio.'
    ],
    validatorChecks: [
      'Confirm all portfolio APIs are authenticated and restricted to the owning user.',
      'Confirm holding updates are idempotent and preserve the unique portfolioId+symbol constraint.',
      'Confirm the analysis layer exposes user-useful portfolio metrics instead of raw CRUD only.',
      'Confirm tests cover cross-user access denial and invalid symbol or holding payloads.'
    ],
    validationCommands: [
      'npm test',
      'npm run build',
      'rg -n "Portfolio|PortfolioHolding|holding|concentration|profit|loss" src tests prisma'
    ],
    promptFocus: [
      'Use the existing portfolio schema; do not redesign it unless strictly necessary.',
      'Ship useful backend outputs first: holdings CRUD, ownership checks, and portfolio metrics.',
      'Keep advice deterministic and derived from the current analysis engine where possible.'
    ]
  }
};

export const usageText = () =>
  [
    'Usage:',
    '  npm run task:iterate -- --scope <scope> [--format json|markdown] [--write]',
    '  npm run task:iterate -- --scope all [--format json|markdown] [--write]',
    '  npm run task:iterate -- --list',
    '',
    'Available scopes:',
    ...SCOPE_ORDER.map((scope) => `  - ${scope}`)
  ].join('\n');

export const ensureReportsDir = () => {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
};

export const buildOutputPath = (scope: string, format: OutputFormat) => {
  const extension = format === 'json' ? 'json' : 'md';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(ensureReportsDir(), `codex-task-${scope}-${timestamp}.${extension}`);
};

const buildPrompt = (spec: ScopeSpec) => {
  const sections = [
    `Task: ${spec.title}`,
    '',
    `Goal: ${spec.objective}`,
    '',
    'Repo context:',
    ...spec.repoContext.map((item) => `- ${item}`),
    '',
    'Required implementation targets:',
    ...spec.implementationTargets.map((item) => `- ${item}`),
    '',
    'Acceptance criteria:',
    ...spec.acceptanceCriteria.map((item) => `- ${item}`),
    '',
    'Guardrails:',
    ...COMMON_GUARDRAILS.map((item) => `- ${item}`),
    '',
    'Focus for this task:',
    ...spec.promptFocus.map((item) => `- ${item}`),
    '',
    'Execution instructions:',
    '- Inspect the existing codebase before editing.',
    '- Implement the backend changes end-to-end, not only a plan.',
    '- Add or update tests for the affected services and routes.',
    '- Keep the final answer concise and include any remaining gaps or follow-up work.'
  ];

  return sections.join('\n');
};

export const buildPacket = (scope: TaskScope): TaskPacket => {
  const spec = SCOPE_SPECS[scope];

  return {
    generatedAt: new Date().toISOString(),
    purpose: 'codex-task-iteration',
    scope,
    title: spec.title,
    summary: spec.summary,
    objective: spec.objective,
    prompt: buildPrompt(spec),
    validator: {
      checks: spec.validatorChecks,
      commands: spec.validationCommands
    },
    repoContext: spec.repoContext,
    implementationTargets: spec.implementationTargets,
    acceptanceCriteria: spec.acceptanceCriteria
  };
};

export const renderMarkdown = (packet: TaskPacket) => {
  const lines = [
    `# ${packet.title}`,
    '',
    `- scope: \`${packet.scope}\``,
    `- generatedAt: \`${packet.generatedAt}\``,
    `- purpose: \`${packet.purpose}\``,
    '',
    '## Summary',
    packet.summary,
    '',
    '## Prompt',
    '```text',
    packet.prompt,
    '```',
    '',
    '## Validator Checks',
    ...packet.validator.checks.map((item) => `- ${item}`),
    '',
    '## Validation Commands',
    ...packet.validator.commands.map((item) => `- \`${item}\``),
    '',
    '## Acceptance Criteria',
    ...packet.acceptanceCriteria.map((item) => `- ${item}`)
  ];

  return lines.join('\n');
};
