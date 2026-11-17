import { reactPlugins } from '@kit/vite-preset/react-plugins';
import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: {
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/__tests__/**/*.dom.test.{ts,tsx}'],
  },
});
