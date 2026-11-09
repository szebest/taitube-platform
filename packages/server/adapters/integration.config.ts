import { definePackageTestConfig } from '@vp/testing';

/** The real screening model from `pnpm models:fetch`; `pnpm test:integration` runs it where it exists. */
export default definePackageTestConfig({
  test: {
    include: [
      'onnx/__tests__/integration/**/*.test.ts',
      'postgres/**/__tests__/integration/fingerprint-lookup.test.ts',
    ],
    testTimeout: 120_000,
  },
});
