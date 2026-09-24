import { definePackageTestConfig } from '@vp/testing';

export const PGLITE_SPECS = ['postgres/repositories/__tests__/postgres-*-repository.test.ts'];

export default definePackageTestConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', ...PGLITE_SPECS],
  },
});
