import { createQueryClient as createClientWith } from '@kit/query';
import type { QueryClient } from '@tanstack/react-query';
import { apiRetryPolicy } from './retry-policy';

export function createQueryClient(): QueryClient {
  return createClientWith(apiRetryPolicy);
}
