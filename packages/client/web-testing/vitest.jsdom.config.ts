import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    name: 'web-testing (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: [
      '@testing-library/jest-dom/vitest',
      'src/jsdom.setup.ts',
      'src/api-server.setup.ts',
    ],
  },
});
