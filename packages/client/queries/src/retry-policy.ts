import { ApiContractError, ApiError } from '@vp/api-client';
import { RETRY_CLASS, type RetryClass, isErrorCode } from '@vp/errors';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const SERVER_ERROR = 500;
const TOO_MANY_REQUESTS = 429;

function statusClass(status: number): RetryClass {
  return status >= SERVER_ERROR || status === TOO_MANY_REQUESTS ? 'transient' : 'permanent';
}

/**
 * A failure the API classified retries as its `RETRY_CLASS` says. A response that is not a problem
 * document falls back to its status, and anything that is not a response (a dropped connection)
 * is transient.
 */
function retryClassOf(error: unknown): RetryClass {
  if (error instanceof ApiContractError) return 'permanent';
  if (!(error instanceof ApiError)) return 'transient';
  return isErrorCode(error.code) ? RETRY_CLASS[error.code] : statusClass(error.status);
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return retryClassOf(error) === 'transient' && failureCount < MAX_RETRIES;
}

/** Exponential backoff with full jitter, unless the server said how long to wait. */
export function retryDelay(failureCount: number, error: unknown, random = Math.random): number {
  if (error instanceof ApiError && error.retryAfterMs !== undefined) return error.retryAfterMs;
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** failureCount);
  return Math.round(random() * ceiling);
}
