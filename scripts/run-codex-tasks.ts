import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildPacket, ensureReportsDir, SCOPE_ORDER, type TaskScope } from './task-iteration-lib';

type RunOptions = {
  scope: TaskScope | 'all';
  model?: string;
  search: boolean;
  dryRun: boolean;
};

const usage = () => {
  console.log(
    [
      'Usage:',
      '  npm run task:run -- [--scope all|<scope>] [--model <model>] [--search] [--dry-run]',
      '',
      'Default scope is all.',
      'Runs Codex sequentially for each scope and writes reports to reports/codex-runs/.',
      '',
      'Available scopes:',
      ...SCOPE_ORDER.map((scope) => `  - ${scope}`)
    ].join('\n')
  );
};

const parseArgs = (argv: string[]): RunOptions => {
  const options: RunOptions = {
    scope: 'all',
    search: false,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const value = argv[index + 1];

    switch (current) {
      case '--scope':
        if (!value) {
          throw new Error('--scope requires a value.');
        }
        if (value !== 'all' && !SCOPE_ORDER.includes(value as TaskScope)) {
          throw new Error(`Unknown scope: ${value}`);
        }
        options.scope = value as TaskScope | 'all';
        index += 1;
        break;
      case '--model':
        if (!value) {
          throw new Error('--model requires a value.');
        }
        options.model = value;
        index += 1;
        break;
      case '--search':
        options.search = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        usage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  return options;
};

const buildExecPrompt = (scope: TaskScope) => {
  const packet = buildPacket(scope);

  return [
    packet.prompt,
    '',
    'Validator checklist:',
    ...packet.validator.checks.map((item) => `- ${item}`),
    '',
    'Suggested validation commands:',
    ...packet.validator.commands.map((item) => `- ${item}`)
  ].join('\n');
};

const makeRunDir = () => {
  const baseDir = path.join(ensureReportsDir(), 'codex-runs');
  fs.mkdirSync(baseDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(baseDir, timestamp);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
};

const runScope = (scope: TaskScope, runDir: string, options: RunOptions) => {
  const prompt = buildExecPrompt(scope);
  const outputPath = path.join(runDir, `${scope}.last-message.txt`);
  const args = [
    '--ask-for-approval',
    'never',
    '--sandbox',
    'workspace-write',
    'exec',
    '--cd',
    process.cwd(),
    '--output-last-message',
    outputPath
  ];

  if (options.model) {
    args.unshift('--model', options.model);
  }

  if (options.search) {
    args.unshift('--search');
  }

  if (options.dryRun) {
    console.log(`\n[dry-run] scope=${scope}`);
    console.log(`codex.cmd ${args.join(' ')}`);
    console.log(prompt);
    return { status: 0 };
  }

  const result = spawnSync('codex.cmd', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: prompt,
    shell: true,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  return result;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const scopes = options.scope === 'all' ? SCOPE_ORDER : [options.scope];
  const runDir = makeRunDir();

  console.log(`Run directory: ${runDir}`);

  for (const scope of scopes) {
    console.log(`\n=== Running scope: ${scope} ===`);
    const result = runScope(scope, runDir, options);

    if (result.status !== 0) {
      if (result.error) {
        console.error(result.error);
      }
      console.error(`Scope failed: ${scope}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log('\nAll scopes completed.');
};

main();
