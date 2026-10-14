import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

const accountKeys = {
  all: ['account'] as const,
  mine: () => [...accountKeys.all, 'mine'] as const,
};

export function accountQueryOptions() {
  return queryOptions({
    queryKey: accountKeys.mine(),
    queryFn: () => apiClient.me.getAccount(),
  });
}
