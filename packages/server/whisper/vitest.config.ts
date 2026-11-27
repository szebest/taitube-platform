import { definePackageTestConfig } from '@kit/testing';

export default definePackageTestConfig({
  test: { exclude: ['src/__tests__/integration/**'] },
});
