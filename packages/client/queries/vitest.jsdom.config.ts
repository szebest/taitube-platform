import { definePackageTestConfig } from '@kit/testing';
import { reactPlugins } from '@kit/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    name: 'queries (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: [
      '@testing-library/jest-dom/vitest',
      '@kit/web-testing/jsdom.setup',
      '@vp/web-testing/api-server.setup',
    ],
  },
});
