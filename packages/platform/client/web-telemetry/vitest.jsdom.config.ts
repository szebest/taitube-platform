import { definePackageTestConfig } from '@kit/testing';
import { reactPlugins } from '@kit/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    name: 'web-telemetry (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: ['@vp/web-testing/jsdom.setup'],
  },
});
