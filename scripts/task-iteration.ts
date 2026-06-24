import fs from 'node:fs';
import path from 'node:path';

import {
  buildOutputPath,
  buildPacket,
  renderMarkdown,
  SCOPE_ORDER,
  type OutputFormat,
  type TaskScope,
  usageText
} from './task-iteration-lib';

const parseArgs = (argv: string[]) => {
  const options: {
    scope?: TaskScope | 'all';
    format: OutputFormat;
    write: boolean;
    list: boolean;
    output?: string;
  } = {
    format: 'markdown',
    write: false,
    list: false
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
      case '--format':
        if (value !== 'json' && value !== 'markdown') {
          throw new Error('--format must be json or markdown.');
        }
        options.format = value;
        index += 1;
        break;
      case '--write':
        options.write = true;
        break;
      case '--list':
        options.list = true;
        break;
      case '--output':
        if (!value) {
          throw new Error('--output requires a value.');
        }
        options.output = value;
        index += 1;
        break;
      case '--help':
        console.log(usageText());
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  return options;
};

const writeOutput = (content: string, explicitOutput: string | undefined, fallbackScope: string) => {
  const outputPath = explicitOutput
    ? path.resolve(process.cwd(), explicitOutput)
    : buildOutputPath(fallbackScope, content.trimStart().startsWith('{') ? 'json' : 'markdown');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    console.log(SCOPE_ORDER.join('\n'));
    return;
  }

  if (!options.scope) {
    console.log(usageText());
    throw new Error('Missing required --scope option.');
  }

  const scopes = options.scope === 'all' ? SCOPE_ORDER : [options.scope];
  const packets = scopes.map((scope) => buildPacket(scope));

  const rendered =
    options.format === 'json'
      ? JSON.stringify(scopes.length === 1 ? packets[0] : packets, null, 2)
      : packets.map((packet) => renderMarkdown(packet)).join('\n\n---\n\n');

  console.log(rendered);

  if (options.write) {
    const outputPath = writeOutput(rendered, options.output, options.scope);
    console.error(`Wrote task packet to ${outputPath}`);
  }
};

main();
