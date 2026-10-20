import { definePackageTestConfig } from '@vp/testing';
import { configDefaults } from 'vitest/config';

export default definePackageTestConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/__tests__/integration/**'],
    globalSetup: ['__tests__/contract/pglite-snapshot.ts'],
  },
});
