import { packageDir } from '../../scripts/workspace-packages';

const WEB_TELEMETRY = packageDir('@kit/web-telemetry');
const WEB_TESTING = packageDir('@kit/web-testing');

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
  'packages/server/demo/src/main.ts',
  'packages/server/deploy/src/main.ts',
  'packages/server/gen-video/src/main.ts',
  'packages/server/lighthouse/src/main.ts',
  'packages/server/upload-client/src/main.ts',
  `${WEB_TELEMETRY}/src/*.setup.ts`,
  'packages/client/web-testing/src/*.setup.ts',
  `${WEB_TESTING}/src/*.setup.ts`,
  'apps/client/web/src/sw.ts',
  'scripts/*.ts',
  'tests/browser/playback.ts',
  'tests/e2e/e2e-runner.ts',
  'tests/e2e/run-e2e.ts',
  'tests/e2e/web-stack.ts',
];

/** Not entrypoints, and still allowed to touch the environment: the test harness and the app config modules. */
export const ENV_HOMES: readonly string[] = [
  'packages/platform/server/testing/src/index.ts',
  'tests/integration/use-real-services.ts',
  'apps/client/*/src/lib/config/index.ts',
  'tests/playwright/config.ts',
];

function matcher(pattern: string): RegExp {
  const escaped = pattern.split('*').map(RegExp.escape).join('[^/]*');
  return new RegExp(`^${escaped}$`);
}

export function isListed(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matcher(pattern).test(file));
}
