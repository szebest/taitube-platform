import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: ['@vp/web-testing/server-functions.setup', '@vp/web-testing/api-server.setup'],
  },
});
