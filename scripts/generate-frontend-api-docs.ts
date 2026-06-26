import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildFrontendApiOpenApiSpec,
  frontendApiOpenApiSpec,
  frontendApiTypesSource,
  frontendEndpointContracts,
  resolveFrontendEndpointScope,
  type FrontendEndpointContract,
  type FrontendEndpointScope
} from '../src/contracts/frontendApi.contract';

const projectRoot = path.resolve(__dirname, '..');
const docsDir = path.join(projectRoot, 'docs');
const scopedDocsDir = path.join(docsDir, 'scopes');

const endpointScopes = [
  ...new Set(frontendEndpointContracts.map((endpoint) => resolveFrontendEndpointScope(endpoint)))
] as FrontendEndpointScope[];

const typeBlockPattern = /^export type (\w+) = [\s\S]*?;\n(?=\nexport type |\s*$)/gm;

const collectExportedTypeBlocks = () => {
  const blocks = new Map<string, string>();
  let match: RegExpExecArray | null = null;

  while ((match = typeBlockPattern.exec(frontendApiTypesSource)) !== null) {
    const name = match[1];
    const block = match[0].trimEnd();
    blocks.set(name, block);
  }

  return blocks;
};

const exportedTypeBlocks = collectExportedTypeBlocks();
const exportedTypeNames = [...exportedTypeBlocks.keys()];

const collectTypeNamesForEndpoints = (endpoints: FrontendEndpointContract[]) => {
  const queue = new Set<string>(['ErrorResponse']);

  for (const endpoint of endpoints) {
    if (endpoint.requestBodyType) {
      queue.add(endpoint.requestBodyType);
    }

    if (endpoint.responseBodyType) {
      queue.add(endpoint.responseBodyType);
    }

    if (endpoint.pathParamsType) {
      queue.add(endpoint.pathParamsType);
    }

    if (endpoint.queryType) {
      queue.add(endpoint.queryType);
    }
  }

  const visited = new Set<string>();
  const ordered: string[] = [];

  while (queue.size > 0) {
    const [current] = queue;
    queue.delete(current);

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const block = exportedTypeBlocks.get(current);
    if (!block) {
      continue;
    }

    ordered.push(current);

    for (const candidate of exportedTypeNames) {
      if (candidate === current || visited.has(candidate)) {
        continue;
      }

      if (new RegExp(`\\b${candidate}\\b`).test(block)) {
        queue.add(candidate);
      }
    }
  }

  return exportedTypeNames.filter((name) => ordered.includes(name));
};

const buildScopedTypesSource = (endpoints: FrontendEndpointContract[]) => {
  const typeNames = collectTypeNamesForEndpoints(endpoints);
  const headerEndIndex = frontendApiTypesSource.indexOf('export type JsonValue =');
  const header = frontendApiTypesSource.slice(0, headerEndIndex);
  const blocks = typeNames
    .map((name) => exportedTypeBlocks.get(name))
    .filter((block): block is string => Boolean(block));

  return `${header}${blocks.join('\n\n')}\n`;
};

const buildScopedOpenApiSpec = (
  endpoints: FrontendEndpointContract[],
  info: {
    title: string;
    version: string;
    description: string;
  }
) => {
  const spec = buildFrontendApiOpenApiSpec(endpoints, info) as {
    components: {
      schemas: Record<string, unknown>;
      securitySchemes: Record<string, unknown>;
    };
  };
  const typeNames = collectTypeNamesForEndpoints(endpoints);
  const usedSchemas = Object.fromEntries(
    Object.entries(spec.components.schemas).filter(([name]) =>
      typeNames.includes(name)
    )
  );
  const securitySchemeNames = new Set<string>();

  for (const endpoint of endpoints) {
    if (endpoint.auth === 'bearer') {
      securitySchemeNames.add('bearerAuth');
    }

    if (endpoint.auth === 'internal-token') {
      securitySchemeNames.add('internalApiToken');
    }

    if (endpoint.auth === 'bale-bot-token') {
      securitySchemeNames.add('baleBotToken');
    }
  }

  const usedSecuritySchemes = Object.fromEntries(
    Object.entries(spec.components.securitySchemes).filter(([name]) =>
      securitySchemeNames.has(name)
    )
  );

  return {
    ...spec,
    components: {
      schemas: usedSchemas,
      securitySchemes: usedSecuritySchemes
    }
  };
};

const buildMarkdown = (
  endpoints: FrontendEndpointContract[],
  options: {
    title: string;
    typesLink: string;
    openApiLink: string;
  }
) => {
  const lines: string[] = [
    `# ${options.title}`,
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
    '- Send the bearer session token in the `Authorization` header when the endpoint requires bearer auth.',
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

  for (const endpoint of endpoints) {
    lines.push(`### ${endpoint.method} ${endpoint.path}`);
    lines.push('');
    lines.push(endpoint.summary);
    lines.push('');
    lines.push(`- Operation ID: \`${endpoint.operationId}\``);
    lines.push(`- Scope: \`${resolveFrontendEndpointScope(endpoint)}\``);
    lines.push(`- Auth: \`${endpoint.auth}\``);
    lines.push(`- Success: \`${endpoint.successStatus}\` -> \`${endpoint.responseBodyType}\``);
    if (endpoint.pathParamsType) {
      lines.push(`- Path params type: \`${endpoint.pathParamsType}\``);
    }
    if (endpoint.queryType) {
      lines.push(`- Query type: \`${endpoint.queryType}\``);
    }
    if (endpoint.requestBodyType) {
      lines.push(`- Request body type: \`${endpoint.requestBodyType}\``);
    }
    lines.push(
      endpoint.errorStatuses.length > 0
        ? `- Error statuses: ${endpoint.errorStatuses.map((status) => `\`${status}\``).join(', ')}`
        : '- Error statuses: none'
    );

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
  lines.push(`Use [frontend-api.types.ts](${options.typesLink}) as the copy/pasteable type source for this scope.`);
  lines.push('');
  lines.push('## Machine-Readable Contract');
  lines.push('');
  lines.push(`Use [openapi.frontend.json](${options.openApiLink}) for Codex agents or generated API clients.`);
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const writeScopeOutput = async (
  outputDir: string,
  endpoints: FrontendEndpointContract[],
  options: {
    title: string;
    spec: unknown;
    typesLink: string;
    openApiLink: string;
  }
) => {
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'openapi.frontend.json'),
    `${JSON.stringify(options.spec, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(outputDir, 'frontend-api.types.ts'),
    buildScopedTypesSource(endpoints),
    'utf8'
  );

  await writeFile(
    path.join(outputDir, 'frontend-api.md'),
    buildMarkdown(endpoints, {
      title: options.title,
      typesLink: options.typesLink,
      openApiLink: options.openApiLink
    }),
    'utf8'
  );
};

const run = async () => {
  await mkdir(docsDir, { recursive: true });
  await mkdir(scopedDocsDir, { recursive: true });

  await writeScopeOutput(docsDir, frontendEndpointContracts, {
    title: 'Frontend API Integration',
    spec: frontendApiOpenApiSpec,
    typesLink: './frontend-api.types.ts',
    openApiLink: './openapi.frontend.json'
  });

  for (const scope of endpointScopes) {
    const endpoints = frontendEndpointContracts.filter(
      (endpoint) => resolveFrontendEndpointScope(endpoint) === scope
    );
    const outputDir = path.join(scopedDocsDir, scope);

    await writeScopeOutput(outputDir, endpoints, {
      title: `Frontend API Integration (${scope})`,
      spec: buildScopedOpenApiSpec(endpoints, {
        title: `Market Frontend Integration Contract (${scope})`,
        version: '2026-06-26.1',
        description: `Machine-readable contract for the ${scope} endpoint scope.`
      }),
      typesLink: './frontend-api.types.ts',
      openApiLink: './openapi.frontend.json'
    });
  }
};

void run();
