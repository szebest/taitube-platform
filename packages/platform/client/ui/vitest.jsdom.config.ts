import { definePackageTestConfig } from '@vp/testing';
import { reactPlugins } from '@vp/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    name: 'ui (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup'],
  },
});
