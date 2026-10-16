import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const accountKeys = {
  all: ['account'] as const,
  mine: () => [...accountKeys.all, 'mine'] as const,
};

export function accountQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: accountKeys.mine(),
    queryFn: () => api.me.getAccount(),
  });
}
