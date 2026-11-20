import { type RetryClass } from '@kit/errors';
import { createRetryPolicy } from '@kit/query';
import { ApiContractError, ApiError } from '@vp/api-client';
import { RETRY_CLASS, isErrorCode } from '@vp/errors';

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

export const apiRetryPolicy = createRetryPolicy({
  classify: retryClassOf,
  retryAfterMs: (error) => (error instanceof ApiError ? error.retryAfterMs : undefined),
});
