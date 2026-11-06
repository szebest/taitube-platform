import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
