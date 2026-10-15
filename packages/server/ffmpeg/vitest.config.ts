import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    globalSetup: ['../../../tests/ensure-fixtures.ts'],
    exclude: ['src/__tests__/integration/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
