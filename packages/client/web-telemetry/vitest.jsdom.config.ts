import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    name: 'web-telemetry (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: ['@vp/web-testing/jsdom.setup'],
  },
});
