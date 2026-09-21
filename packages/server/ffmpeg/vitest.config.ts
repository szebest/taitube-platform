import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
