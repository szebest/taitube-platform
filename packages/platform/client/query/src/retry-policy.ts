import type { RetryClass } from '@kit/errors';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export type RetryPolicyOptions = {
  /** Says whether a failure is worth asking again for; anything that is not a response is the app's call too. */
  classify: (error: unknown) => RetryClass;
  /** How long the server asked the caller to wait, when the failure carries it. */
  retryAfterMs?: (error: unknown) => number | undefined;
};

export type RetryPolicy = {
  shouldRetry: (failureCount: number, error: unknown) => boolean;
  /** Exponential backoff with full jitter, unless the server said how long to wait. */
  retryDelay: (failureCount: number, error: unknown, random?: () => number) => number;
};

export function createRetryPolicy({ classify, retryAfterMs }: RetryPolicyOptions): RetryPolicy {
  return {
    shouldRetry: (failureCount, error) =>
      classify(error) === 'transient' && failureCount < MAX_RETRIES,
    retryDelay: (failureCount, error, random = Math.random) => {
      const asked = retryAfterMs?.(error);
      if (asked !== undefined) return asked;
      const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** failureCount);
      return Math.round(random() * ceiling);
    },
  };
}
