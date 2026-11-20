import { environmentManager, QueryClient } from '@tanstack/react-query';
import type { RetryPolicy } from './retry-policy';

const SECOND_MS = 1000;

// Above zero, or the hydrated page refetches everything the server just loaded.
const QUERY_STALE_TIME_MS = 30 * SECOND_MS;

// A server render waits on its loaders, so a retried outage would hold the response for seconds.
export function createQueryClient({ shouldRetry, retryDelay }: RetryPolicy): QueryClient {
  const retry = environmentManager.isServer() ? false : shouldRetry;
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: QUERY_STALE_TIME_MS, retry, retryDelay },
      mutations: { retry: false },
    },
  });
}
