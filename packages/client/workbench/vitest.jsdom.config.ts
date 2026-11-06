import { definePackageTestConfig } from '@vp/testing';
import { reactPlugins } from '@vp/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    name: 'workbench (jsdom)',
    environment: 'jsdom',
    include: ['{src,visual}/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup'],
  },
});
