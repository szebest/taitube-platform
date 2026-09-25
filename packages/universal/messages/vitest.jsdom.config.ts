import { definePackageTestConfig } from '@vp/testing';

/**
 * The same suites again in a browser environment: a message that renders differently here than
 * under node hands an SSR hydration a mismatch.
 */
export default definePackageTestConfig({
  test: { name: 'messages (jsdom)', environment: 'jsdom' },
});
