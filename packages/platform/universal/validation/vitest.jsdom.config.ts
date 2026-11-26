import { definePackageTestConfig } from '@kit/testing';

/**
 * The same suites again in a browser environment: a rule a form runs before a request must not reach
 * for a server global.
 */
export default definePackageTestConfig({
  test: { name: '@kit/validation (jsdom)', environment: 'jsdom' },
});
