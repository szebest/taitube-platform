import { definePackageTestConfig } from '@vp/testing';

/** Specs that encode real fixtures with FFmpeg; `pnpm test:integration` runs them in their own job. */
export default definePackageTestConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
