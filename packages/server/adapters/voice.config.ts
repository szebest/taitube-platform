import { definePackageTestConfig } from '@kit/testing';

/** The adapter contract against a running LiveKit; `make smoke-voice` starts the voice profile and runs it. */
export default definePackageTestConfig({
  test: {
    include: ['livekit/__tests__/integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
