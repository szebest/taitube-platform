import { definePackageTestConfig } from '@vp/testing';

// Several stage tests shell out to real FFmpeg, which takes every core it can get. Under
// the full suite's parallelism they contend with every other worker, so they need the same
// allowance packages/ffmpeg already grants its own FFmpeg tests.
export default definePackageTestConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
