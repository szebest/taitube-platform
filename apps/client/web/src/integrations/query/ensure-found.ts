import type { EnsureQueryDataOptions, QueryClient, QueryKey } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { fromPromise, isOk } from '@vp/result';

const NOT_FOUND = 404;

export async function ensureFound<T, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions<T, Error, T, TKey>
): Promise<T> {
  const loaded = await fromPromise(
    () => queryClient.ensureQueryData(options),
    (cause) => cause
  );
  if (isOk(loaded)) return loaded.value;
  if (loaded.error instanceof ApiError && loaded.error.status === NOT_FOUND) throw notFound();
  throw loaded.error;
}
