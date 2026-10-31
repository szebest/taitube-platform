import { queryOptions } from '@tanstack/react-query';
import { ApiError, type ApiClient } from '@vp/api-client';
import { fromPromise, isOk } from '@vp/result';

const NOT_FOUND = 404;

export const homeKeys = {
  all: ['home'] as const,
  shelves: () => [...homeKeys.all, 'shelves'] as const,
  pick: () => [...homeKeys.all, 'pick'] as const,
};

export function homeQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: homeKeys.shelves(),
    queryFn: () => api.recommendations.getHome(),
  });
}

/** The spotlight, or `null` when nothing is scheduled and nothing is trending (the API's 404). */
export function currentPickQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: homeKeys.pick(),
    queryFn: async () => {
      const current = await fromPromise(
        () => api.picks.getCurrentPick(),
        (cause) => cause
      );
      if (isOk(current)) return current.value;
      if (current.error instanceof ApiError && current.error.status === NOT_FOUND) return null;
      throw current.error;
    },
  });
}
