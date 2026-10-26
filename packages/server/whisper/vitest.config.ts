import { definePackageTestConfig } from '@vp/testing';

export default definePackageTestConfig({
  test: { exclude: ['src/__tests__/integration/**'] },
});
