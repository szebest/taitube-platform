import { type ViteUserConfig, defineConfig } from 'vitest/config';

/**
 * Standard test fixtures based on SDD domain model and .env.example contracts.
 */
export const FIXTURES = {
  VIDEO_ID: '00000000-0000-7000-8000-000000000001',
  USER_ID: '00000000-0000-7000-8000-000000000002',
  ADMIN_ID: '00000000-0000-7000-8000-000000000003',
  TRACEPARENT: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  SAMPLE_MP4_KEY: '00000000-0000-7000-8000-000000000001/source.mp4',
} as const;

/**
 * Helper to define package-level Vitest configs with consistent defaults.
 */
export function definePackageTestConfig(
  overrides: ViteUserConfig = {}
): ReturnType<typeof defineConfig> {
  const { test: testOverrides, ...rootOverrides } = overrides;

  return defineConfig({
    ...rootOverrides,
    test: {
      environment: 'node',
      globals: true,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      include: ['src/**/__tests__/**/*.test.ts'],
      ...testOverrides,
    },
  });
}

/**
 * Mock BullMQ job builder for testing worker stages.
 */
export interface MockJob<T = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  updateProgress: (progress: number | object) => Promise<void>;
  log: (row: string) => Promise<number>;
}

export function createMockJob<T extends Record<string, unknown>>(
  name: string,
  data: T,
  overrides: Partial<MockJob<T>> = {}
): MockJob<T> {
  return {
    id: `${name}-job-${Date.now()}`,
    name,
    data,
    attemptsMade: 0,
    updateProgress: async () => {},
    log: async () => 1,
    ...overrides,
  };
}

/**
 * Helper to run a test with temporary environment variable overrides.
 */
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
