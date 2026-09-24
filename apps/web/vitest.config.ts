import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
