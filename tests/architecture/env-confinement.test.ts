import { productionSources, read } from './repo-files';

/**
 * The environment is read where a process starts and nowhere else: the loader, the schema, the
 * test harness and any module that ends its own process. Everything below takes configuration as
 * a value, which is what lets a test build it without mutating globals.
 */
const HOMES = [
  'packages/server/config/',
  'packages/server/env-schema/',
  'packages/server/testing/',
];
const SERVER_ROOTS = ['apps/api/', 'apps/worker/', 'packages/server/', 'scripts/'];

function isEntrypoint(file: string, source: string): boolean {
  return (
    /^apps\/[\w-]+\/src\/main\.ts$/.test(file) ||
    file.endsWith('.config.ts') ||
    /\bprocess\.exit\(/.test(source)
  );
}

function readsEnvOutsideAHome(file: string, source: string): boolean {
  return (
    /\bprocess\.env\b/.test(source) &&
    !HOMES.some((home) => file.startsWith(home)) &&
    !isEntrypoint(file, source)
  );
}

describe('architecture: process.env is read only where a process starts', () => {
  it('recognises an env read added to a service', () => {
    const service = "export const bucket = () => process.env['S3_BUCKET_RAW'] ?? 'raw';";

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
