import { type ViteUserConfig, defineConfig } from 'vite-plus';

/**
 * Every package's test config. Spies, stubbed env vars and stubbed globals are restored before each
 * test, so no spec needs an `afterEach` to undo them.
 */
export function definePackageTestConfig(overrides: ViteUserConfig = {}): ViteUserConfig {
  const { test: testOverrides, ...rootOverrides } = overrides;

  return defineConfig({
    ...rootOverrides,
    test: {
      environment: 'node',
      pool: 'threads',
      isolate: false,
      globals: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      include: ['src/**/__tests__/**/*.test.ts'],
      ...testOverrides,
    },
  });
}

/** Runs `fn` with the given variables set, or unset for `undefined`, and restores the rest after. */
export async function withEnv<R>(
  envOverrides: Record<string, string | undefined>,
  fn: () => Promise<R> | R
): Promise<R> {
  const originalEnv = { ...process.env };
  try {
    for (const [key, value] of Object.entries(envOverrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    return await fn();
  } finally {
    process.env = originalEnv;
  }
}
