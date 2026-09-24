import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'scripts',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
