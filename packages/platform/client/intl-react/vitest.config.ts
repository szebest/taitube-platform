import { definePackageTestConfig } from '@vp/testing';
import { reactPlugins } from '@vp/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
