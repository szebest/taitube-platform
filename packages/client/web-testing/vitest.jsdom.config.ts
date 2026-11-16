import { definePackageTestConfig } from '@vp/testing';
import { reactPlugins } from '@vp/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    name: 'web-testing (jsdom)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.dom.test.{ts,tsx}'],
    setupFiles: [
      '@testing-library/jest-dom/vitest',
      'src/jsdom.setup.ts',
      'src/api-server.setup.ts',
      'src/settle.setup.ts',
    ],
    env: { RTL_SKIP_AUTO_CLEANUP: 'true' },
  },
});
