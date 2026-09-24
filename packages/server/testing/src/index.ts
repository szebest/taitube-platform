import { type ViteUserConfig, defineConfig } from 'vitest/config';

/**
 * The rows every in-memory `Repositories` and the development seed start with. A spec that acts as
 * "the dev user" or reads "the seeded video" names it from here.
 */
export const SEEDED = {
  userId: '00000000-0000-7000-8000-000000000001',
  otherUserId: '00000000-0000-7000-8000-000000000002',
  channelId: '00000000-0000-7000-8000-000000000101',
  otherChannelId: '00000000-0000-7000-8000-000000000102',
  videoId: '018f0000-0000-7000-8000-000000000001',
  otherVideoId: '018f0000-0000-7000-8000-000000000002',
} as const;

/**
 * Every package's test config. Spies and stubbed env vars are restored before each test, so no spec
 * needs an `afterEach` to undo them.
 */
export function definePackageTestConfig(
  overrides: ViteUserConfig = {}
): ViteUserConfig {
  const { test: testOverrides, ...rootOverrides } = overrides;

  return defineConfig({
    ...rootOverrides,
    test: {
      environment: 'node',
      globals: true,
      restoreMocks: true,
      unstubEnvs: true,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      include: ['src/**/__tests__/**/*.test.ts'],
      ...testOverrides,
    },
  });
}

export interface MockJob<T> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  updateProgress: (progress: number | object) => Promise<void>;
}

/** A queue job as a stage receives one, on its first attempt unless `overrides` says otherwise. */
export function createMockJob<T>(
  name: string,
  data: T,
  overrides: Partial<MockJob<T>> = {}
): MockJob<T> {
  return {
    id: `${name}-job`,
    name,
    data,
    attemptsMade: 0,
    updateProgress: async () => {},
    ...overrides,
  };
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
