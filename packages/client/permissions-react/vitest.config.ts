import { definePackageTestConfig } from '@kit/testing';
import { reactPlugins } from '@kit/vite-preset/react-plugins';

export default definePackageTestConfig({
  plugins: reactPlugins(),
  test: { include: ['src/**/__tests__/**/*.test.{ts,tsx}'] },
});
