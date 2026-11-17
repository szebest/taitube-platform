import { reactPlugins } from '@kit/vite-preset/react-plugins';
import { definePackageTestConfig } from '@vp/testing';

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
