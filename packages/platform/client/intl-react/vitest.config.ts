import { reactPlugins } from '@kit/vite-preset/react-plugins';
import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    environment: 'jsdom',
    isolate: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
