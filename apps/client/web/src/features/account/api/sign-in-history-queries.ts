import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { identityKeys, KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

/** The account's own sign-ins, newest first, a keyset page at a time. */
export function signInHistoryQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: [...identityKeys.all, 'sign-ins'],
    queryFn: ({ pageParam }) =>
      api.accountSecurity.listMySignIns({ query: { cursor: pageParam, limit: KEYSET_PAGE_SIZE } }),
    ...keysetPaging,
  });
}
