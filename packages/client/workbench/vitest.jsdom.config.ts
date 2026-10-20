import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    name: 'workbench (jsdom)',
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup'],
  },
});
