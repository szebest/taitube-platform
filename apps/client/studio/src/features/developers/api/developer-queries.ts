import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export const developerKeys = {
  all: ['developers'] as const,
  tokens: () => [...developerKeys.all, 'tokens'] as const,
  webhooks: () => [...developerKeys.all, 'webhooks'] as const,
  exports: () => [...developerKeys.all, 'exports'] as const,
};

/** The viewer's personal access tokens of every channel, newest first; never their secrets. */
export function apiTokensQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: developerKeys.tokens(),
    queryFn: () => api.apiTokens.listApiTokens(),
  });
}

export function webhooksQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: developerKeys.webhooks(),
    queryFn: () => api.webhooks.listWebhooks(),
  });
}

/** The acting channel's exports the viewer may see, newest first, keyset-paged. */
export function exportsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: developerKeys.exports(),
    queryFn: ({ pageParam }) =>
      api.channelExports.listChannelExports({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
