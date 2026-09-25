import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    globalSetup: ['__tests__/contract/pglite-snapshot.ts'],
  },
});
