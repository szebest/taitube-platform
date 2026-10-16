import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    name: 'queries (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: [
      '@testing-library/jest-dom/vitest',
      '@vp/web-testing/jsdom.setup',
      '@vp/web-testing/api-server.setup',
    ],
  },
});
