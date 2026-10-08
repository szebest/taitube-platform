import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

const accountKeys = {
  all: ['account'] as const,
};

export function accountQueryOptions() {
  return queryOptions({
    queryKey: accountKeys.all,
    queryFn: () => apiClient.me.getAccount(),
  });
}
