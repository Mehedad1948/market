import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  frontendApiOpenApiSpec,
  frontendApiTypesSource,
  frontendEndpointContracts
} from '../src/contracts/frontendApi.contract';

const projectRoot = path.resolve(__dirname, '..');
const docsDir = path.join(projectRoot, 'docs');

const buildMarkdown = () => {
  const lines: string[] = [
    '# Frontend API Integration',
    '',
    'This document is generated from `src/contracts/frontendApi.contract.ts`.',
    '',
    '## Base URL',
    '',
    '- Local: `http://localhost:3000`',
    '- Production: use your deployed API origin',
    '',
    '## Authentication',
    '',
    '- Send the bearer session token in the `Authorization` header.',
    '- Example: `Authorization: Bearer <session-token>`',
    '',
    '## Error Shape',
    '',
    '```ts',
    "type ErrorResponse = {",
    "  status: 'ERROR';",
    '  message: string;',
    '  englishMessage?: string;',
    '  issues?: unknown;',
    '  limit?: number;',
    '  accessLevel?: string;',
    '  [key: string]: unknown;',
    '};',
    '```',
    '',
    '## Endpoints',
    ''
  ];

  for (const endpoint of frontendEndpointContracts) {
    lines.push(`### ${endpoint.method} ${endpoint.path}`);
    lines.push('');
    lines.push(endpoint.summary);
    lines.push('');
    lines.push(`- Operation ID: \`${endpoint.operationId}\``);
    lines.push(`- Auth: \`${endpoint.auth}\``);
    lines.push(`- Success: \`${endpoint.successStatus}\` -> \`${endpoint.responseBodyType}\``);
    if (endpoint.requestBodyType) {
      lines.push(`- Request body type: \`${endpoint.requestBodyType}\``);
    }
    lines.push(`- Error statuses: ${endpoint.errorStatuses.map((status) => `\`${status}\``).join(', ')}`);

    if (endpoint.notes && endpoint.notes.length > 0) {
      lines.push('- Notes:');
      for (const note of endpoint.notes) {
        lines.push(`  - ${note}`);
      }
    }

    lines.push('');
  }

  lines.push('## Frontend Type Source');
  lines.push('');
  lines.push('Use [frontend-api.types.ts](./frontend-api.types.ts) as the copy/pasteable type source in another frontend project.');
  lines.push('');
  lines.push('## Machine-Readable Contract');
  lines.push('');
  lines.push('Use [openapi.frontend.json](./openapi.frontend.json) for Codex agents or generated API clients.');
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const run = async () => {
  await mkdir(docsDir, { recursive: true });

  await writeFile(
    path.join(docsDir, 'openapi.frontend.json'),
    `${JSON.stringify(frontendApiOpenApiSpec, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(docsDir, 'frontend-api.types.ts'),
    frontendApiTypesSource,
    'utf8'
  );

  await writeFile(
    path.join(docsDir, 'frontend-api.md'),
    buildMarkdown(),
    'utf8'
  );
};

void run();
