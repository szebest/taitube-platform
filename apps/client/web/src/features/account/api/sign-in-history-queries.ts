import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { identityKeys, KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export const signInHistoryKeys = {
  all: [...identityKeys.all, 'sign-ins'] as const,
};

/** The account's own sign-ins, newest first, a keyset page at a time. */
export function signInHistoryQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: signInHistoryKeys.all,
    queryFn: ({ pageParam }) =>
      api.accountSecurity.listMySignIns({ query: { cursor: pageParam, limit: KEYSET_PAGE_SIZE } }),
    ...keysetPaging,
  });
}
