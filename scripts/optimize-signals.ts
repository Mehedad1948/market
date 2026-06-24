import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type VariantKey =
  | 'full_composite'
  | 'stochRsi_only'
  | 'priceTrend_only'
  | 'mfi_only'
  | 'liquidity_only'
  | 'composite_without_atr'
  | 'composite_without_adx'
  | 'composite_without_stochRsi'
  | 'composite_without_priceTrend'
  | 'composite_without_mfi';

type HorizonKey = '20d' | '60d';

type ScoringOverrides = Partial<{
  liquidityWeight: number;
  stochRsiWeight: number;
  priceTrendWeight: number;
  mfiWeight: number;
  adxWeight: number;
  atrPenaltyWeight: number;
  trendResilienceWeight: number;
}>;

type SweepMode = 'windows' | 'weights' | 'combined';

type HorizonMetrics = {
  sampleCount: number;
  avgReturn: number;
  medianReturn: number;
  winRate: number;
  negativeReturnRate: number;
  bestReturn: number;
  worstReturn: number;
  avgMaxDrawdown: number;
  worstDrawdown: number;
  profitFactorLikeRatio: number | null;
};

type ReportGroup = {
  key: string;
  sampleCount: number;
  horizons: Record<string, HorizonMetrics>;
};

type BacktestReportPayload = {
  sampleCount: number;
  global: {
    overall: ReportGroup;
    byCompositeAction?: ReportGroup[];
    byScoreBucket?: ReportGroup[];
  };
};

type CompareVariantResponse = {
  key: VariantKey;
  report: BacktestReportPayload | null;
};

type CompareResponse = {
  status: 'OK';
  symbol: string;
  comparisonCount: number;
  variants: CompareVariantResponse[];
  compactReport?: {
    filePath: string;
    fileName: string;
  };
};

type WindowsConfig = {
  weeklyWindow: number;
  monthlyWindow: number;
  quarterlyWindow: number;
};

type ExperimentConfig = WindowsConfig & {
  iteration: number;
  candidateLabel: string;
  scoringOverrides?: ScoringOverrides;
};

type VariantScore = {
  key: VariantKey;
  score: number;
  overall20d: HorizonMetrics | null;
  overall60d: HorizonMetrics | null;
};

type ExperimentEvaluation = {
  config: ExperimentConfig;
  objectiveScore: number;
  fullCompositeScore: number;
  cautionShare: number | null;
  holdShare: number | null;
  holdVsCaution20d: number | null;
  holdVsCaution60d: number | null;
  compactReportPath: string | null;
  variantScores: VariantScore[];
  indicatorImpact: Record<string, number | null>;
  recommendations: string[];
};

type OptimizationArtifact = {
  purpose: 'signal-optimization-loop';
  sourceMethod: {
    name: string;
    url: string;
    notes: string[];
  };
  generatedAt: string;
  endpoint: string;
  symbol: string;
  search: {
    baseline: WindowsConfig;
    maxIterations: number;
    maxCandidatesPerIteration: number;
    minScoreGain: number;
    sweepMode: SweepMode;
    variants: VariantKey[];
  };
  best: ExperimentEvaluation;
  experiments: ExperimentEvaluation[];
};

const DEFAULT_ENDPOINT = 'http://localhost:3005/api/stocks/backtests/compare';
const DEFAULT_VARIANTS_QUICK: VariantKey[] = [
  'full_composite',
  'priceTrend_only',
  'stochRsi_only',
  'mfi_only',
  'composite_without_adx',
  'composite_without_stochRsi',
  'composite_without_priceTrend',
  'composite_without_mfi'
];

const DEFAULT_VARIANTS_FULL: VariantKey[] = [
  ...DEFAULT_VARIANTS_QUICK,
  'liquidity_only',
  'composite_without_atr'
];

const VALID_VARIANTS = new Set<VariantKey>(DEFAULT_VARIANTS_FULL);

const OFFICIAL_METHOD_URL =
  'https://developers.openai.com/codex/use-cases/iterate-on-difficult-problems';

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const usage = () => {
  process.stdout.write(
    [
      'Usage:',
      '  npm run optimize:signals -- --symbol <SYMBOL> [options]',
      '',
      'Options:',
      '  --endpoint <url>',
      '  --symbol <symbol>',
      '  --dateFrom <yyyy-mm-dd or jalali string>',
      '  --dateTo <yyyy-mm-dd or jalali string>',
      '  --weeklyWindow <number>',
      '  --monthlyWindow <number>',
      '  --quarterlyWindow <number>',
      '  --maxIterations <number>',
      '  --maxCandidatesPerIteration <number>',
      '  --minScoreGain <number>',
      '  --reportLimit <number>',
      '  --maxSnapshotsPerSymbol <number>',
      '  --includeRealLegal <true|false>',
      '  --variantProfile <quick|full>',
      '  --sweepMode <windows|weights|combined>',
      '  --variants <comma-separated variant keys>',
      '',
      'Example:',
      '  npm run optimize:signals -- --symbol فملی --dateFrom 1401-01-01 --dateTo 1405-01-08'
    ].join('\n')
  );
};

const parseBoolean = (value: string) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid boolean value: ${value}`);
};

const parseNumber = (value: string, label: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${label}: ${value}`);
  }
  return parsed;
};

const parseVariantList = (value: string): VariantKey[] => {
  const variants = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (variants.length === 0) {
    throw new Error('At least one variant must be provided.');
  }

  const invalid = variants.filter(
    (entry): entry is string => !VALID_VARIANTS.has(entry as VariantKey)
  );
  if (invalid.length > 0) {
    throw new Error(`Unknown variants: ${invalid.join(', ')}`);
  }

  return variants as VariantKey[];
};

const parseArgs = (argv: string[]) => {
  const options: {
    endpoint: string;
    symbol?: string;
    dateFrom?: string;
    dateTo?: string;
    weeklyWindow: number;
    monthlyWindow: number;
    quarterlyWindow: number;
    maxIterations: number;
    maxCandidatesPerIteration: number;
    minScoreGain: number;
    reportLimit: number;
    maxSnapshotsPerSymbol?: number;
    includeRealLegal: boolean;
    variants: VariantKey[];
    sweepMode: SweepMode;
  } = {
    endpoint: DEFAULT_ENDPOINT,
    weeklyWindow: 7,
    monthlyWindow: 30,
    quarterlyWindow: 90,
    maxIterations: 3,
    maxCandidatesPerIteration: 2,
    minScoreGain: 0.5,
    reportLimit: 50000,
    includeRealLegal: false,
    variants: DEFAULT_VARIANTS_QUICK,
    sweepMode: 'combined'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current?.startsWith('--')) {
      continue;
    }

    if (current === '--help') {
      usage();
      process.exit(0);
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`Missing value for argument ${current}`);
    }

    switch (current) {
      case '--endpoint':
        options.endpoint = value;
        break;
      case '--symbol':
        options.symbol = value;
        break;
      case '--dateFrom':
        options.dateFrom = value;
        break;
      case '--dateTo':
        options.dateTo = value;
        break;
      case '--weeklyWindow':
        options.weeklyWindow = parseNumber(value, current);
        break;
      case '--monthlyWindow':
        options.monthlyWindow = parseNumber(value, current);
        break;
      case '--quarterlyWindow':
        options.quarterlyWindow = parseNumber(value, current);
        break;
      case '--maxIterations':
        options.maxIterations = parseNumber(value, current);
        break;
      case '--maxCandidatesPerIteration':
        options.maxCandidatesPerIteration = parseNumber(value, current);
        break;
      case '--minScoreGain':
        options.minScoreGain = parseNumber(value, current);
        break;
      case '--reportLimit':
        options.reportLimit = parseNumber(value, current);
        break;
      case '--maxSnapshotsPerSymbol':
        options.maxSnapshotsPerSymbol = parseNumber(value, current);
        break;
      case '--includeRealLegal':
        options.includeRealLegal = parseBoolean(value);
        break;
      case '--variantProfile':
        if (value === 'quick') {
          options.variants = DEFAULT_VARIANTS_QUICK;
          break;
        }
        if (value === 'full') {
          options.variants = DEFAULT_VARIANTS_FULL;
          break;
        }
        throw new Error(`Unknown variant profile: ${value}`);
      case '--sweepMode':
        if (value === 'windows' || value === 'weights' || value === 'combined') {
          options.sweepMode = value;
          break;
        }
        throw new Error(`Unknown sweep mode: ${value}`);
      case '--variants':
        options.variants = parseVariantList(value);
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }

    index += 1;
  }

  if (!options.symbol) {
    throw new Error('The --symbol argument is required.');
  }

  if (
    !(
      options.weeklyWindow < options.monthlyWindow &&
      options.monthlyWindow < options.quarterlyWindow
    )
  ) {
    throw new Error('weeklyWindow < monthlyWindow < quarterlyWindow must hold.');
  }

  return options as typeof options & { symbol: string };
};

const getGroupByKey = (groups: ReportGroup[] | undefined, key: string) =>
  groups?.find((group) => group.key === key) ?? null;

const getVariant = (
  response: CompareResponse,
  key: VariantKey
): CompareVariantResponse | null =>
  response.variants.find((variant) => variant.key === key) ?? null;

const getHorizon = (
  report: BacktestReportPayload | null,
  horizon: HorizonKey
): HorizonMetrics | null => report?.global.overall.horizons[horizon] ?? null;

const scoreHorizon = (metrics: HorizonMetrics | null, weight: number) => {
  if (!metrics) {
    return 0;
  }

  const profitFactor = metrics.profitFactorLikeRatio ?? 0;
  return (
    metrics.avgReturn * weight +
    profitFactor * (weight / 12) +
    metrics.winRate * (weight / 8) +
    metrics.medianReturn * (weight / 4) +
    metrics.bestReturn * (weight / 20) +
    metrics.avgMaxDrawdown * (weight / 6)
  );
};

const evaluateFullComposite = (report: BacktestReportPayload | null) => {
  const overall20d = getHorizon(report, '20d');
  const overall60d = getHorizon(report, '60d');
  const hold = getGroupByKey(report?.global.byCompositeAction, 'HOLD');
  const caution = getGroupByKey(report?.global.byCompositeAction, 'CAUTION');
  const hold20d = hold?.horizons['20d'] ?? null;
  const hold60d = hold?.horizons['60d'] ?? null;
  const caution20d = caution?.horizons['20d'] ?? null;
  const caution60d = caution?.horizons['60d'] ?? null;
  const sampleCount = report?.sampleCount ?? 0;
  const cautionShare =
    caution && sampleCount > 0 ? caution.sampleCount / sampleCount : null;
  const holdShare = hold && sampleCount > 0 ? hold.sampleCount / sampleCount : null;
  const holdVsCaution20d =
    hold20d && caution20d ? hold20d.avgReturn - caution20d.avgReturn : null;
  const holdVsCaution60d =
    hold60d && caution60d ? hold60d.avgReturn - caution60d.avgReturn : null;

  let score = scoreHorizon(overall20d, 280) + scoreHorizon(overall60d, 180);

  if (holdVsCaution20d !== null) {
    score += holdVsCaution20d * 220;
  }
  if (holdVsCaution60d !== null) {
    score += holdVsCaution60d * 80;
  }
  if (
    hold20d?.profitFactorLikeRatio !== null &&
    hold20d?.profitFactorLikeRatio !== undefined &&
    caution20d?.profitFactorLikeRatio !== null &&
    caution20d?.profitFactorLikeRatio !== undefined
  ) {
    score +=
      (hold20d.profitFactorLikeRatio - caution20d.profitFactorLikeRatio) * 10;
  }
  if (cautionShare !== null) {
    score -= cautionShare * 14;
  }
  if (holdShare !== null) {
    score += Math.min(holdShare, 0.45) * 6;
  }

  return {
    score: round(score),
    cautionShare: cautionShare !== null ? round(cautionShare) : null,
    holdShare: holdShare !== null ? round(holdShare) : null,
    holdVsCaution20d: holdVsCaution20d !== null ? round(holdVsCaution20d) : null,
    holdVsCaution60d: holdVsCaution60d !== null ? round(holdVsCaution60d) : null
  };
};

const buildVariantScores = (response: CompareResponse): VariantScore[] =>
  response.variants.map((variant) => {
    const overall20d = getHorizon(variant.report, '20d');
    const overall60d = getHorizon(variant.report, '60d');
    const score = round(scoreHorizon(overall20d, 140) + scoreHorizon(overall60d, 100));

    return {
      key: variant.key,
      score,
      overall20d,
      overall60d
    };
  });

const buildIndicatorImpact = (
  response: CompareResponse,
  fullCompositeScore: number
) => {
  const comparisons: Record<string, VariantKey> = {
    atr: 'composite_without_atr',
    adx: 'composite_without_adx',
    stochRsi: 'composite_without_stochRsi',
    priceTrend: 'composite_without_priceTrend',
    mfi: 'composite_without_mfi'
  };

  const result: Record<string, number | null> = {};

  for (const [indicator, variantKey] of Object.entries(comparisons)) {
    const variant = getVariant(response, variantKey);
    if (!variant?.report) {
      result[indicator] = null;
      continue;
    }

    const withoutScore = evaluateFullComposite(variant.report).score;
    result[indicator] = round(withoutScore - fullCompositeScore);
  }

  return result;
};

const buildRecommendations = (
  response: CompareResponse,
  evaluation: ReturnType<typeof evaluateFullComposite>,
  indicatorImpact: Record<string, number | null>
) => {
  const recommendations: string[] = [];
  const priceTrend = getVariant(response, 'priceTrend_only')?.report ?? null;
  const stochRsi = getVariant(response, 'stochRsi_only')?.report ?? null;
  const mfi = getVariant(response, 'mfi_only')?.report ?? null;

  const priceTrendScore = evaluateFullComposite(priceTrend).score;
  const stochRsiScore = evaluateFullComposite(stochRsi).score;
  const mfiScore = evaluateFullComposite(mfi).score;

  if (evaluation.cautionShare !== null && evaluation.cautionShare > 0.55) {
    recommendations.push(
      'CAUTION share is still too high; keep tightening downgrade rules and let resilient pullbacks stay in HOLD.'
    );
  }

  if (
    evaluation.holdVsCaution20d !== null &&
    evaluation.holdVsCaution20d > 0.02 &&
    evaluation.cautionShare !== null &&
    evaluation.cautionShare > 0.45
  ) {
    recommendations.push(
      'HOLD is clearly outperforming CAUTION on 20d, so the routing issue is classification breadth, not the core trend logic.'
    );
  }

  if (priceTrendScore > stochRsiScore + 6) {
    recommendations.push(
      'Price-trend logic is materially stronger than Stoch RSI alone; keep Stoch RSI as timing, not as a primary standalone vote.'
    );
  }

  if (mfi && mfiScore > stochRsiScore + 2) {
    recommendations.push(
      'MFI is adding more standalone signal quality than Stoch RSI in this run; consider increasing its weight only after confirming the full composite also improves.'
    );
  }

  for (const [indicator, deltaWithout] of Object.entries(indicatorImpact)) {
    if (deltaWithout === null) {
      continue;
    }

    if (deltaWithout > 1) {
      recommendations.push(
        `Removing ${indicator} improved the full composite score; this indicator is currently hurting the blend and should be down-weighted or gated.`
      );
    } else if (deltaWithout < -1) {
      recommendations.push(
        `Removing ${indicator} degraded the full composite score; keep ${indicator} as a meaningful contributor.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'No single indicator is dominating the optimization result; focus next on composite routing thresholds rather than adding more indicators.'
    );
  }

  return recommendations;
};

const evaluateResponse = (
  response: CompareResponse,
  config: ExperimentConfig
): ExperimentEvaluation => {
  const fullComposite = getVariant(response, 'full_composite')?.report ?? null;
  const fullEvaluation = evaluateFullComposite(fullComposite);
  const variantScores = buildVariantScores(response);
  const indicatorImpact = buildIndicatorImpact(response, fullEvaluation.score);
  const recommendations = buildRecommendations(
    response,
    fullEvaluation,
    indicatorImpact
  );

  return {
    config,
    objectiveScore: fullEvaluation.score,
    fullCompositeScore: fullEvaluation.score,
    cautionShare: fullEvaluation.cautionShare,
    holdShare: fullEvaluation.holdShare,
    holdVsCaution20d: fullEvaluation.holdVsCaution20d,
    holdVsCaution60d: fullEvaluation.holdVsCaution60d,
    compactReportPath: response.compactReport?.filePath ?? null,
    variantScores,
    indicatorImpact,
    recommendations
  };
};

const buildPayload = (
  args: ReturnType<typeof parseArgs>,
  config: WindowsConfig & { scoringOverrides?: ScoringOverrides }
) => {
  const payload: Record<string, unknown> = {
    symbol: args.symbol,
    weeklyWindow: config.weeklyWindow,
    monthlyWindow: config.monthlyWindow,
    quarterlyWindow: config.quarterlyWindow,
    includeRealLegal: args.includeRealLegal,
    variants: args.variants,
    reportLimit: args.reportLimit
  };

  if (args.dateFrom) {
    payload.dateFrom = args.dateFrom;
  }
  if (args.dateTo) {
    payload.dateTo = args.dateTo;
  }
  if (args.maxSnapshotsPerSymbol !== undefined) {
    payload.maxSnapshotsPerSymbol = args.maxSnapshotsPerSymbol;
  }
  if (config.scoringOverrides) {
    payload.scoringOverrides = config.scoringOverrides;
  }

  return payload;
};

const postCompare = async (
  endpoint: string,
  payload: Record<string, unknown>
): Promise<CompareResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Compare request failed with ${response.status} ${response.statusText}: ${text}`
      );
    }

    return (await response.json()) as CompareResponse;
  } finally {
    clearTimeout(timeout);
  }
};

const configKey = (config: WindowsConfig & { scoringOverrides?: ScoringOverrides }) =>
  `${config.weeklyWindow}-${config.monthlyWindow}-${config.quarterlyWindow}-${JSON.stringify(
    config.scoringOverrides ?? {}
  )}`;

const normalizeConfig = (config: WindowsConfig): WindowsConfig | null => {
  const normalized = {
    weeklyWindow: Math.max(3, Math.round(config.weeklyWindow)),
    monthlyWindow: Math.max(10, Math.round(config.monthlyWindow)),
    quarterlyWindow: Math.max(20, Math.round(config.quarterlyWindow))
  };

  if (
    !(
      normalized.weeklyWindow < normalized.monthlyWindow &&
      normalized.monthlyWindow < normalized.quarterlyWindow
    )
  ) {
    return null;
  }

  return normalized;
};

const buildNeighborConfigs = (base: WindowsConfig) => {
  const rawCandidates: Array<WindowsConfig & { label: string }> = [
    {
      label: 'monthly_minus_5',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow - 5,
      quarterlyWindow: base.quarterlyWindow
    },
    {
      label: 'monthly_plus_5',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow + 5,
      quarterlyWindow: base.quarterlyWindow
    },
    {
      label: 'monthly_plus_10',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow + 10,
      quarterlyWindow: base.quarterlyWindow
    },
    {
      label: 'quarterly_minus_15',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow,
      quarterlyWindow: base.quarterlyWindow - 15
    },
    {
      label: 'quarterly_plus_15',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow,
      quarterlyWindow: base.quarterlyWindow + 15
    },
    {
      label: 'quarterly_plus_30',
      weeklyWindow: base.weeklyWindow,
      monthlyWindow: base.monthlyWindow,
      quarterlyWindow: base.quarterlyWindow + 30
    },
    {
      label: 'faster_stack',
      weeklyWindow: base.weeklyWindow - 1,
      monthlyWindow: base.monthlyWindow - 5,
      quarterlyWindow: base.quarterlyWindow - 15
    },
    {
      label: 'slower_stack',
      weeklyWindow: base.weeklyWindow + 1,
      monthlyWindow: base.monthlyWindow + 5,
      quarterlyWindow: base.quarterlyWindow + 15
    },
    {
      label: 'weekly_minus_2',
      weeklyWindow: base.weeklyWindow - 2,
      monthlyWindow: base.monthlyWindow,
      quarterlyWindow: base.quarterlyWindow
    },
    {
      label: 'weekly_plus_2',
      weeklyWindow: base.weeklyWindow + 2,
      monthlyWindow: base.monthlyWindow,
      quarterlyWindow: base.quarterlyWindow
    }
  ];

  const unique = new Map<string, WindowsConfig & { label: string }>();

  for (const candidate of rawCandidates) {
    const normalized = normalizeConfig(candidate);
    if (!normalized) {
      continue;
    }

    const key = configKey(normalized);
    if (!unique.has(key)) {
      unique.set(key, { ...normalized, label: candidate.label });
    }
  }

  return [...unique.values()];
};

const buildWeightNeighborConfigs = (
  base: WindowsConfig & { scoringOverrides?: ScoringOverrides }
) => {
  const current = {
    liquidityWeight: 1,
    stochRsiWeight: 1,
    priceTrendWeight: 1,
    mfiWeight: 1,
    adxWeight: 1,
    atrPenaltyWeight: 1,
    trendResilienceWeight: 1,
    ...(base.scoringOverrides ?? {})
  };

  const mutate = (
    label: string,
    patch: ScoringOverrides
  ): (WindowsConfig & { label: string; scoringOverrides: ScoringOverrides }) => ({
    label,
    weeklyWindow: base.weeklyWindow,
    monthlyWindow: base.monthlyWindow,
    quarterlyWindow: base.quarterlyWindow,
    scoringOverrides: {
      ...current,
      ...patch
    }
  });

  return [
    mutate('priceTrend_up', { priceTrendWeight: round(current.priceTrendWeight + 0.2, 3) }),
    mutate('priceTrend_down', {
      priceTrendWeight: round(Math.max(0.4, current.priceTrendWeight - 0.15), 3)
    }),
    mutate('stochRsi_down', {
      stochRsiWeight: round(Math.max(0.4, current.stochRsiWeight - 0.15), 3)
    }),
    mutate('mfi_up', { mfiWeight: round(current.mfiWeight + 0.2, 3) }),
    mutate('adx_up', { adxWeight: round(current.adxWeight + 0.2, 3) }),
    mutate('atrPenalty_down', {
      atrPenaltyWeight: round(Math.max(0.4, current.atrPenaltyWeight - 0.15), 3)
    }),
    mutate('trendResilience_up', {
      trendResilienceWeight: round(current.trendResilienceWeight + 0.2, 3)
    }),
    mutate('liquidity_up', {
      liquidityWeight: round(current.liquidityWeight + 0.15, 3)
    })
  ];
};

const interleaveCandidates = <T>(groups: T[][]): T[] => {
  const result: T[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      const candidate = group[index];
      if (candidate !== undefined) {
        result.push(candidate);
      }
    }
  }

  return result;
};

const writeArtifact = async (artifact: OptimizationArtifact) => {
  const reportsDir = path.join(process.cwd(), 'reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(reportsDir, `signal-optimization-${timestamp}.json`);

  await mkdir(reportsDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(artifact, null, 2), 'utf8');

  return filePath;
};

const logEvaluation = (evaluation: ExperimentEvaluation) => {
  const lines = [
    '',
    `[iteration ${evaluation.config.iteration}] ${evaluation.config.candidateLabel}`,
    `windows: ${evaluation.config.weeklyWindow}/${evaluation.config.monthlyWindow}/${evaluation.config.quarterlyWindow}`,
    `weights: ${JSON.stringify(evaluation.config.scoringOverrides ?? {})}`,
    `score: ${evaluation.objectiveScore}`,
    `holdVsCaution20d: ${evaluation.holdVsCaution20d ?? 'n/a'}`,
    `holdVsCaution60d: ${evaluation.holdVsCaution60d ?? 'n/a'}`,
    `cautionShare: ${evaluation.cautionShare ?? 'n/a'}`,
    `report: ${evaluation.compactReportPath ?? 'n/a'}`
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const experiments: ExperimentEvaluation[] = [];
  const seenConfigs = new Set<string>();

  const evaluateConfig = async (
    config: ExperimentConfig
  ): Promise<ExperimentEvaluation> => {
    const key = configKey(config);
    if (seenConfigs.has(key)) {
      const cached = experiments.find((entry) => configKey(entry.config) === key);
      if (!cached) {
        throw new Error(`Missing cached experiment for config ${key}`);
      }
      return cached;
    }

    const payload = buildPayload(args, config);
    const response = await postCompare(args.endpoint, payload);
    const evaluation = evaluateResponse(response, config);
    experiments.push(evaluation);
    seenConfigs.add(key);
    logEvaluation(evaluation);
    return evaluation;
  };

  const baselineConfig: ExperimentConfig = {
    iteration: 0,
    candidateLabel: 'baseline',
    weeklyWindow: args.weeklyWindow,
    monthlyWindow: args.monthlyWindow,
    quarterlyWindow: args.quarterlyWindow
  };

  let best = await evaluateConfig(baselineConfig);

  for (let iteration = 1; iteration <= args.maxIterations; iteration += 1) {
    const windowCandidates =
      args.sweepMode === 'weights'
        ? []
        : buildNeighborConfigs(best.config).map((candidate) => ({
            iteration,
            candidateLabel: candidate.label,
            weeklyWindow: candidate.weeklyWindow,
            monthlyWindow: candidate.monthlyWindow,
            quarterlyWindow: candidate.quarterlyWindow,
            ...(best.config.scoringOverrides
              ? { scoringOverrides: best.config.scoringOverrides }
              : {})
          }));
    const weightCandidates =
      args.sweepMode === 'windows'
        ? []
        : buildWeightNeighborConfigs(best.config).map((candidate) => ({
            iteration,
            candidateLabel: candidate.label,
            weeklyWindow: candidate.weeklyWindow,
            monthlyWindow: candidate.monthlyWindow,
            quarterlyWindow: candidate.quarterlyWindow,
            scoringOverrides: candidate.scoringOverrides
          }));
    const candidates =
      args.sweepMode === 'combined'
        ? interleaveCandidates([windowCandidates, weightCandidates])
        : [...windowCandidates, ...weightCandidates];

    const newCandidates = candidates
      .filter((candidate) => !seenConfigs.has(configKey(candidate)))
      .slice(0, args.maxCandidatesPerIteration);

    if (newCandidates.length === 0) {
      break;
    }

    let iterationBest = best;
    for (const candidate of newCandidates) {
      const evaluation = await evaluateConfig(candidate);
      if (evaluation.objectiveScore > iterationBest.objectiveScore) {
        iterationBest = evaluation;
      }
    }

    if (iterationBest.objectiveScore - best.objectiveScore < args.minScoreGain) {
      break;
    }

    best = iterationBest;
  }

  const artifact: OptimizationArtifact = {
    purpose: 'signal-optimization-loop',
    sourceMethod: {
      name: 'Codex-style difficult-problem iteration',
      url: OFFICIAL_METHOD_URL,
      notes: [
        'Start from a baseline.',
        'Change one thing at a time through small neighboring experiments.',
        'Score every run with explicit machine-readable criteria.',
        'Stop when gains flatten instead of continuing blind trial-and-error.'
      ]
    },
    generatedAt: new Date().toISOString(),
    endpoint: args.endpoint,
    symbol: args.symbol,
    search: {
      baseline: {
        weeklyWindow: args.weeklyWindow,
        monthlyWindow: args.monthlyWindow,
        quarterlyWindow: args.quarterlyWindow
      },
      maxIterations: args.maxIterations,
      maxCandidatesPerIteration: args.maxCandidatesPerIteration,
      minScoreGain: args.minScoreGain,
      sweepMode: args.sweepMode,
      variants: args.variants
    },
    best,
    experiments: [...experiments].sort(
      (left, right) => right.objectiveScore - left.objectiveScore
    )
  };

  const artifactPath = await writeArtifact(artifact);

  process.stdout.write(
    [
      '',
      `best windows: ${best.config.weeklyWindow}/${best.config.monthlyWindow}/${best.config.quarterlyWindow}`,
      `best score: ${best.objectiveScore}`,
      `artifact: ${artifactPath}`
    ].join('\n')
  );
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
