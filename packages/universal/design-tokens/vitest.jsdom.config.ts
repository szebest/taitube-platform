import { definePackageTestConfig } from '@vp/testing';

// A universal package must also pass in a browser: a server global fails here, not in review.
export default definePackageTestConfig({
  test: { name: 'design-tokens (jsdom)', environment: 'jsdom' },
});
