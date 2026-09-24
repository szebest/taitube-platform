import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    exclude: ['src/__tests__/integration/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
