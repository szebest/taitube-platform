import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    isolate: false,
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
