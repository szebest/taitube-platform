import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
