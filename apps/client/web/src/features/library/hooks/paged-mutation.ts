import { type InfiniteData, mutationOptions, type QueryKey } from '@tanstack/react-query';

import { editPages, type PagedKey, type PagedSnapshot, restorePages } from '../api/paged-list';

export interface PagedMutation<TPage, TVariables> {
  key: PagedKey<TPage>;
  request: (variables: TVariables) => Promise<unknown>;
  edit: (data: InfiniteData<TPage>, variables: TVariables) => InfiniteData<TPage>;
  /** Keys that go stale beside the list; the list's own key when none are given. */
  invalidate?: QueryKey[];
}

/**
 * A change to a keyset list: the cached pages take it first, the request follows, a failure puts
 * the pages back, and the list asks the server again once it settles.
 */
export function pagedMutationOptions<TPage, TVariables>({
  key,
  request,
  edit,
  invalidate = [key],
}: PagedMutation<TPage, TVariables>) {
  return mutationOptions<unknown, Error, TVariables, PagedSnapshot<TPage>>({
    mutationFn: request,
    onMutate: (variables, { client }) => editPages(client, key, (data) => edit(data, variables)),
    onError: (_error, _variables, snapshot, { client }) => restorePages(client, key, snapshot),
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}
