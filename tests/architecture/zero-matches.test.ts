import { read, trackedFiles } from './repo-files';

/** `apps`, `packages` and `scripts`, without specs, `__tests__` or `__mocks__`. */
const PRODUCTION_SOURCE = [
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

const SPEC_EXCLUSIONS = PRODUCTION_SOURCE.filter((spec) => spec.startsWith(':(exclude'));

function productionUnder(dir: string): string[] {
  return [`:(glob)${dir}/**/*.ts`, ...SPEC_EXCLUSIONS];
}

interface Row {
  name: string;
  pattern: RegExp;
  /** Git pathspecs; `expected` counts matches across them, not files. */
  scope: readonly string[];
  expected: number;
  /** Source the pattern must match, so a row that can never fire fails instead of passing. */
  fires: string;
}

const ROWS: readonly Row[] = [
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
    name: 'an error turned into text by hand',
    pattern: /instanceof\s+Error\s*\?/g,
    scope: [...PRODUCTION_SOURCE, 'tests/e2e'],
    expected: 0,
    fires: 'const text =\n  cause instanceof Error\n    ? cause.message\n    : String(cause);',
  },
];

function countMatches(pattern: RegExp, sources: readonly string[]): number {
  return sources.reduce((total, source) => total + (source.match(pattern)?.length ?? 0), 0);
}

describe('architecture: zero-matches', () => {
  it('counts every match, not every file', () => {
    expect(countMatches(/worker-\$\{process\.pid\}/g, ['`worker-${process.pid}`', 'none'])).toBe(1);
    expect(countMatches(/000000000003/g, ["'000000000003' '000000000003'", "'000000000003'"])).toBe(
      3
    );
  });

  it('reads the console row over entrypoints, scripts and the e2e runner too', () => {
    const consoleRow = ROWS.find((row) => row.name.startsWith('console'));
    const files = trackedFiles(...(consoleRow?.scope ?? []));

    expect(files).toContain('apps/api/src/main.ts');
    expect(files).toContain('scripts/run-e2e.ts');
    expect(files).toContain('tests/e2e/e2e-runner.ts');
  });

  it('reads production source without specs, __tests__ or __mocks__', () => {
    const files = trackedFiles(...PRODUCTION_SOURCE);

    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((file) => /\.test\.tsx?$|__(tests|mocks)__/.test(file))).toEqual([]);
  });

  it.each(ROWS)('fires on its own fixture: $name', ({ pattern, fires }) => {
    expect(countMatches(pattern, [fires])).toBeGreaterThan(0);
  });

  it.each(ROWS)('holds $name at the expected count', ({ pattern, scope, expected }) => {
    const files = trackedFiles(...scope);

    expect(files.length).toBeGreaterThan(0);
    expect(countMatches(pattern, files.map(read))).toBe(expected);
  });
});
