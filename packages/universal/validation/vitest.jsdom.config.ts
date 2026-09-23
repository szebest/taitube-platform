import { definePackageTestConfig } from '@vp/testing';

/**
 * The same suites again in a browser environment. A rule that reaches for a server global fails a
 * test rather than a review, which is what "universal" has to mean for a package `apps/web` imports.
 */
export default definePackageTestConfig({
  test: { name: 'validation (jsdom)', environment: 'jsdom' },
});
