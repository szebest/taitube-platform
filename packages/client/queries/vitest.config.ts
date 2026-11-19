import { definePackageTestConfig } from '@kit/testing';
import { reactPlugins } from '@kit/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: ['@vp/web-testing/server-functions.setup', '@vp/web-testing/api-server.setup'],
  },
});
