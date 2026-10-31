import { mutationOptions, type QueryKey } from '@tanstack/react-query';

import { type CachedKey, editQuery, type QuerySnapshot, restoreQuery } from '../api/cached-query';

export interface QueryMutation<TData, TVariables> {
  key: CachedKey<TData>;
  request: (variables: TVariables) => Promise<unknown>;
  edit: (data: TData, variables: TVariables) => TData;
  /** Keys that go stale beside the query; the query's own key when none are given. */
  invalidate?: QueryKey[];
}

/**
 * A change to cached data: the cache takes it first, the request follows, a failure puts the data
 * back, and the query asks the server again once it settles.
 */
export function queryMutationOptions<TData, TVariables>({
  key,
  request,
  edit,
  invalidate = [key],
}: QueryMutation<TData, TVariables>) {
  return mutationOptions<unknown, Error, TVariables, QuerySnapshot<TData>>({
    mutationFn: request,
    onMutate: (variables, { client }) => editQuery(client, key, (data) => edit(data, variables)),
    onError: (_error, _variables, snapshot, { client }) => restoreQuery(client, key, snapshot),
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}
