import { fromPromise, isOk } from '@kit/result';
import type { EnsureQueryDataOptions, QueryClient, QueryKey } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';

export type EnsureFound = <T, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions<T, Error, T, TKey>
) => Promise<T>;

/** The app says which failure means the resource does not exist; that one renders the not-found page. */
export function createEnsureFound(isMissing: (error: unknown) => boolean): EnsureFound {
  return async (queryClient, options) => {
    const loaded = await fromPromise(
      () => queryClient.query({ ...options, staleTime: 'static' }),
      (cause) => cause
    );
    if (isOk(loaded)) return loaded.value;
    if (isMissing(loaded.error)) throw notFound();
    throw loaded.error;
  };
}
