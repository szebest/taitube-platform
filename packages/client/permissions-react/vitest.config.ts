import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: { include: ['src/**/__tests__/**/*.test.{ts,tsx}'] },
});
