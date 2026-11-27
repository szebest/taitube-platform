import { definePackageTestConfig } from '@kit/testing';

export default definePackageTestConfig({
  test: {
    include: ['postgres/**/__tests__/integration/*.perf.test.ts'],
    testTimeout: 600_000,
  },
});
