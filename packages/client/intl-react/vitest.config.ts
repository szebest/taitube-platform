import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
