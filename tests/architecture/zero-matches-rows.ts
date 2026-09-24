/** `apps`, `packages` and `scripts`, without specs, `__tests__` or `__mocks__`. */
export const PRODUCTION_SOURCE = [
  ':(glob)apps/**/*.ts',
  ':(glob)apps/**/*.tsx',
  ':(glob)packages/**/*.ts',
  ':(glob)packages/**/*.tsx',
  ':(glob)scripts/**/*.ts',
  ':(exclude,glob)**/*.test.ts',
  ':(exclude,glob)**/*.test.tsx',
  ':(exclude,glob)**/__tests__/**',
  ':(exclude,glob)**/__mocks__/**',
];

/** git drops every file when an exclusion does not share the include's directory prefix. */
function productionUnder(dir: string): string[] {
  return [
    `:(glob)${dir}/**/*.ts`,
    `:(exclude,glob)${dir}/**/*.test.ts`,
    `:(exclude,glob)${dir}/**/__tests__/**`,
    `:(exclude,glob)${dir}/**/__mocks__/**`,
  ];
}

export interface Row {
  name: string;
  pattern: RegExp;
  /** Git pathspecs; `expected` counts matches across them, not files. */
  scope: readonly string[];
  expected: number;
  /** Source the pattern must match, so a row that can never fire fails instead of passing. */
  fires: string;
}

export const ROWS: readonly Row[] = [
  {
    name: 'an exception list for a ratchet',
    pattern: /untested-sources|UNTESTED_SOURCES|shrinkOnly/g,
    scope: ['tests/architecture', ':(exclude)tests/architecture/zero-matches-rows.ts'],
    expected: 0,
    fires: "import { UNTESTED_SOURCES } from './untested-sources';",
  },
  {
    name: 'a local copy of a shared test fixture',
    pattern: /function (createMockJob|setupUploadedVideo|freePort)\b/g,
    scope: [
      ':(glob)apps/**/*.ts',
      ':(glob)apps/**/*.tsx',
      ':(glob)packages/**/*.ts',
      ':(exclude,glob)packages/server/testing/**',
    ],
    expected: 0,
    fires: 'async function freePort(): Promise<number> {',
  },
  {
    name: 'the seeded user id written out in a spec',
    pattern: /00000000-0000-7000-8000-000000000001/g,
    scope: [
      ':(glob)**/*.test.ts',
      ':(glob)**/*.test.tsx',
      ':(exclude)tests/architecture/zero-matches-rows.ts',
    ],
    expected: 0,
    fires: "const OWNER = '00000000-0000-7000-8000-000000000001';",
  },
  {
    name: 'the hard-coded admin-token user id',
    pattern: /000000000003/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: "const ADMIN = '00000000-0000-7000-8000-000000000003';",
  },
  {
    name: 'the dev seed in the migrate Job',
    pattern: /@vp\/db\/seed/g,
    scope: ['apps/api/src/migrate.ts'],
    expected: 0,
    fires: "import { seedDatabase } from '@vp/db/seed';",
  },
  {
    name: 'a composition root defaulting its config',
    pattern: /\?\? inProcessAppConfig/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: 'const config = options.config ?? inProcessAppConfig();',
  },
  {
    name: 'the worker id default, outside composition',
    pattern: /worker-\$\{process\.pid\}/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: 'workerId: `worker-${process.pid}`',
  },
  {
    name: 'the module-level metrics singleton',
    pattern: /(?<!async )\bgetMetrics\(/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: 'getMetrics().jobsProcessed.inc();',
  },
  {
    name: 'a metrics server',
    pattern: /\bclass MetricsServer\b|\bfunction startMetricsServer\b/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: 'export function startMetricsServer(port: number) {}',
  },
  {
    name: 'a default-metrics collector',
    pattern: /\bcollectDefaultMetrics\(/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: 'collectDefaultMetrics({ register });',
  },
  {
    name: 'Bull Board inside a service',
    pattern: /@bull-board/g,
    scope: productionUnder('apps/api/src/services'),
    expected: 0,
    fires: "import { createBullBoard } from '@bull-board/api';",
  },
  {
    name: 'the heartbeat path outside the Heartbeat and composition',
    pattern: /\bheartbeatPath\b/g,
    scope: [
      ...PRODUCTION_SOURCE,
      ':(exclude)apps/worker/src/composition',
      ':(exclude)packages/server/env-schema',
    ],
    expected: 0,
    fires: 'await fs.writeFile(config.worker.heartbeatPath, now);',
  },
  {
    name: 'a throwing parse in a stage',
    pattern: /\.parse\(/g,
    scope: productionUnder('apps/worker/src/stages'),
    expected: 0,
    fires: 'const data = ProbeJob.parse(job.data);',
  },
  {
    name: 'a throwing parse in a service',
    pattern: /\.parse\(/g,
    scope: productionUnder('apps/api/src/services'),
    expected: 0,
    fires: 'const body = JSON.parse(raw);',
  },
  {
    name: 'a failure classified by its message',
    pattern: /message\.includes/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: "if (err.message.includes('ENOSPC')) return 'disk';",
  },
  {
    name: 'a cast through unknown',
    pattern: /as unknown as/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: 'const job = raw as unknown as QueueJob;',
  },
  {
    name: 'console, anywhere a process runs',
    pattern: /\bconsole\./g,
    scope: [...PRODUCTION_SOURCE, 'tests/e2e'],
    expected: 0,
    fires: "console.error('fatal', err);",
  },
  {
    name: 'pino outside @vp/logger',
    pattern: /from 'pino'/g,
    scope: [...PRODUCTION_SOURCE, 'tests/e2e', ':(exclude)packages/server/logger'],
    expected: 0,
    fires: "import pino from 'pino';",
  },
  {
    name: 'logging re-exported from @vp/observability',
    pattern: /createLogger|LogContext|from 'pino'/g,
    scope: productionUnder('packages/server/observability'),
    expected: 0,
    fires: "export { createLogger } from './logger';",
  },
  {
    name: 'an error logged as its message',
    pattern: /\berr:\s*[\w.]+\.message\b/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: "log.error({ err: added.error.message }, 'could not add');",
  },
  {
    name: 'a MinIO image from the registries upstream stopped publishing to',
    pattern: /quay\.io\/minio|\bminio\/(minio|mc):/g,
    scope: ['infra', '.github', 'scripts', 'Makefile'],
    expected: 0,
    fires: 'image: quay.io/minio/minio:latest',
  },
  {
    name: 'an error turned into text by hand',
    pattern: /instanceof\s+Error\s*\?/g,
    scope: [...PRODUCTION_SOURCE, 'tests/e2e'],
    expected: 0,
    fires: 'const text =\n  cause instanceof Error\n    ? cause.message\n    : String(cause);',
  },
  {
    name: 'the part-manifest rule, called by upload-complete',
    pattern: /\bdecidePartManifest\(/g,
    scope: ['apps/api/src/services/upload-complete.ts'],
    expected: 1,
    fires: 'const manifest = decidePartManifest({ upload, parts });',
  },
  {
    name: 'the size-match rule, called by upload-complete',
    pattern: /\bdecideSizeMatch\(/g,
    scope: ['apps/api/src/services/upload-complete.ts'],
    expected: 1,
    fires: 'const size = decideSizeMatch({ video, actualSizeBytes });',
  },
  {
    name: 'a problem content type',
    pattern: /\bPROBLEM_CONTENT_TYPE =/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: "export const PROBLEM_CONTENT_TYPE = 'application/problem+json';",
  },
  {
    name: 'an adapter-local unavailable helper',
    pattern: /private unavailable\(/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: 'private unavailable(operation: string) {',
  },
  {
    name: 'an unavailable factory',
    pattern: /\bfunction unavailable\b/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: 'function unavailable(code: ErrorCode) {',
  },
  {
    name: 'a BullMQ health body',
    pattern: /status === 'ready'/g,
    scope: productionUnder('packages/server/adapters/bullmq'),
    expected: 1,
    fires: "if (this.connection.status === 'ready') return ok();",
  },
  {
    name: 'a hand-built object key',
    pattern: /`(raw|videos)\//g,
    scope: [...PRODUCTION_SOURCE, ':(exclude)packages/server/storage/src/keys.ts'],
    expected: 0,
    fires: 'const key = `videos/${videoId}/hls/master.m3u8`;',
  },
  {
    name: 'the rendition names, listed once in the ladder module',
    pattern: /'1080p', '720p'/g,
    scope: PRODUCTION_SOURCE,
    expected: 1,
    fires: "export const RENDITIONS = ['1080p', '720p', '480p'] as const;",
  },
  {
    name: 'the dead default ladder',
    pattern: /\bDEFAULT_LADDER\b/g,
    scope: PRODUCTION_SOURCE,
    expected: 0,
    fires: 'ladder: DEFAULT_LADDER,',
  },
  {
    name: 'a script run by Bun instead of tsx',
    pattern: /\bbun (?!test\b)[\w./-]+\.ts\b/g,
    scope: ['package.json', 'Makefile', '.github'],
    expected: 0,
    fires: '"e2e": "bun scripts/run-e2e.ts",',
  },
  {
    name: 'a doc asking for an import extension',
    pattern: /\.js`? (extension|specifier)|carr(y|ies) `\.js`/g,
    scope: [
      'ARCHITECTURE.md',
      ':(glob)packages/universal/**/AGENTS.md',
      ':(glob)packages/client/**/AGENTS.md',
    ],
    expected: 0,
    fires: 'Relative imports carry `.js` so Node resolves them.',
  },
];
