import { definePackageTestConfig } from '@vp/testing';
import { reactPlugins } from '@vp/vite-preset/react-plugins';

/** The differential specs once more without the React Compiler, against the same snapshots. */
export default definePackageTestConfig({
  plugins: reactPlugins(false),
  test: {
    name: 'ui (jsdom, uncompiled)',
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.differential.dom.test.tsx'],
    setupFiles: ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup'],
  },
});
