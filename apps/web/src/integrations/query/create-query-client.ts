import { QueryClient } from '@tanstack/react-query';

const SECOND_MS = 1000;

// Above zero, or the hydrated page refetches everything the server just loaded.
const QUERY_STALE_TIME_MS = 30 * SECOND_MS;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
  });
}
