import { productionSources, read } from './repo-files';

/**
 * The environment is read where a process starts and nowhere else: the loader, the schema, the
 * test harness and the entrypoints named below. Everything under them takes configuration as a
 * value, which is what lets a test build it without mutating globals.
 */
const HOMES = [
  'packages/server/config/',
  'packages/server/env-schema/',
  'packages/server/testing/',
];
const SERVER_ROOTS = ['apps/api/', 'apps/worker/', 'packages/server/', 'scripts/'];

const ENTRYPOINTS = new Set([
  'apps/api/src/main.ts',
  'apps/worker/src/main.ts',
  'packages/server/compose-autoscaler/src/cli.ts',
  'packages/server/db/src/migrate.ts',
  'packages/server/db/src/seed.ts',
  'packages/server/dev-token/src/index.ts',
  'packages/server/gen-video/src/index.ts',
  'packages/server/upload-client/src/cli.ts',
  'scripts/run-e2e.ts',
]);

function readsEnvOutsideAHome(file: string, source: string): boolean {
  return (
    /\bprocess\.env\b/.test(source) &&
    !HOMES.some((home) => file.startsWith(home)) &&
    !ENTRYPOINTS.has(file) &&
    !file.endsWith('.config.ts')
  );
}

describe('architecture: process.env is read only where a process starts', () => {
  it('recognises an env read added to a service', () => {
    const service = "export const bucket = () => process.env['S3_BUCKET_RAW'] ?? 'raw';";

    expect(readsEnvOutsideAHome('apps/api/src/services/upload-service.ts', service)).toBe(true);
  });

  it('does not exempt a module for ending its own process', () => {
    const service = "const bucket = process.env['S3_BUCKET_RAW']; if (!bucket) process.exit(1);";

    expect(readsEnvOutsideAHome('apps/api/src/services/upload-service.ts', service)).toBe(true);
  });

  it('allows the entrypoint that starts the process', () => {
    const main = "if (process.env.NODE_ENV !== 'test') main().catch(() => process.exit(1));";

    expect(readsEnvOutsideAHome('apps/api/src/main.ts', main)).toBe(false);
  });

  it('finds no env read below an entrypoint in server code', () => {
    const offenders = productionSources()
      .filter((file) => SERVER_ROOTS.some((root) => file.startsWith(root)))
      .filter((file) => readsEnvOutsideAHome(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
