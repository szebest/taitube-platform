import { definePackageTestConfig } from '@kit/testing';

export default definePackageTestConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
  },
});
