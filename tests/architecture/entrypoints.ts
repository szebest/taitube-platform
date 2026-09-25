/**
 * Where a process starts. Module-level side effects, `console` and reading the environment belong
 * here and nowhere else; every module below one takes what it needs as a value.
 */
export const ENTRYPOINTS: readonly string[] = [
  'apps/api/src/gen-contracts.ts',
  'apps/api/src/instrument.ts',
  'apps/api/src/main.ts',
  'apps/api/src/migrate.ts',
  'apps/api/src/seed.ts',
  'apps/worker/src/instrument.ts',
  'apps/worker/src/main.ts',
  'packages/server/compose-autoscaler/src/main.ts',
  'packages/server/dev-token/src/main.ts',
  'packages/server/gen-video/src/main.ts',
  'packages/server/upload-client/src/main.ts',
  'scripts/*.ts',
  'tests/e2e/e2e-runner.ts',
  'tests/e2e/run-e2e.ts',
];

/** Not entrypoints, and still allowed to touch the environment: the loader and the test harness. */
export const ENV_HOMES: readonly string[] = [
  'packages/server/config/src/load-env.ts',
  'packages/server/testing/src/index.ts',
  'apps/web/src/config/index.ts',
];

function matcher(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

export function isListed(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matcher(pattern).test(file));
}
