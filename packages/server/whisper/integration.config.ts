import { definePackageTestConfig } from '@vp/testing';

/** The real whisper-cli over the real model; `pnpm test:integration` runs it where both exist. */
export default definePackageTestConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
