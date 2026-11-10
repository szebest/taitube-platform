import { definePackageTestConfig } from '@vp/testing';

/** The screen stage over the real ffmpeg and fpcalc; `pnpm test:integration` runs it where both exist. */
export default definePackageTestConfig({
  test: {
    include: ['src/**/__tests__/integration/**/*.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
