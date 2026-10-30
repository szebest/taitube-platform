import { QueryClient, environmentManager } from '@tanstack/react-query';
import { ApiError } from '@vp/api-client';

const SECOND_MS = 1000;
const SERVER_ERROR = 500;
const MAX_RETRIES = 3;

// Above zero, or the hydrated page refetches everything the server just loaded.
const QUERY_STALE_TIME_MS = 30 * SECOND_MS;

function retriesAfter(failureCount: number, error: Error): boolean {
  const refused = error instanceof ApiError && error.status < SERVER_ERROR;
  return !refused && failureCount < MAX_RETRIES;
}

// A server render waits on its loaders, so a retried outage would hold the response for seconds.
export function createQueryClient(): QueryClient {
  const retry = environmentManager.isServer() ? false : retriesAfter;
  return new QueryClient({
    defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS, retry } },
  });
}
