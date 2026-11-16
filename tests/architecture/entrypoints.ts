import { packageDir } from '../../scripts/workspace-packages';

const WEB_TELEMETRY = packageDir('@vp/web-telemetry');
const COMPOSE_AUTOSCALER = packageDir('@vp/compose-autoscaler');
const CONFIG = packageDir('@vp/config');
const DEV_TOKEN = packageDir('@vp/dev-token');

/**
 * Where a process starts. Module-level side effects, `console` and reading the environment belong
 * here and nowhere else; every module below one takes what it needs as a value.
 */
export const ENTRYPOINTS: readonly string[] = [
  'apps/server/api/src/gen-contracts.ts',
  'apps/server/api/src/instrument.ts',
  'apps/server/api/src/main.ts',
  'apps/server/api/src/migrate.ts',
  'apps/server/api/src/seed.ts',
  'apps/client/*/playwright.config.ts',
  'packages/client/workbench/visual/playwright.config.ts',
  'apps/server/worker/src/instrument.ts',
  'apps/server/worker/src/main.ts',
  `${COMPOSE_AUTOSCALER}/src/main.ts`,
  'packages/server/demo/src/main.ts',
  'packages/server/deploy/src/main.ts',
  `${DEV_TOKEN}/src/main.ts`,
  'packages/server/gen-video/src/main.ts',
  'packages/server/lighthouse/src/main.ts',
  'packages/server/upload-client/src/main.ts',
  `${WEB_TELEMETRY}/src/*.setup.ts`,
  'packages/client/web-testing/src/*.setup.ts',
  'apps/client/web/src/sw.ts',
  'scripts/*.ts',
  'tests/browser/playback.ts',
  'tests/e2e/e2e-runner.ts',
  'tests/e2e/run-e2e.ts',
  'tests/e2e/web-stack.ts',
];

/** Not entrypoints, and still allowed to touch the environment: the loader and the test harness. */
export const ENV_HOMES: readonly string[] = [
  `${CONFIG}/src/load-env.ts`,
  'packages/server/testing/src/index.ts',
  'apps/client/*/src/lib/config/index.ts',
  'tests/playwright/config.ts',
];

function matcher(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

export function isListed(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matcher(pattern).test(file));
}
