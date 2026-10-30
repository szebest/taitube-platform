import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';

export const clipKeys = {
  all: ['clips'] as const,
  detail: (clipId: string) => [...clipKeys.all, 'detail', clipId] as const,
  mine: () => [...clipKeys.all, 'mine'] as const,
};

export function clipQueryOptions(api: ApiClient, clipId: string) {
  return queryOptions({
    queryKey: clipKeys.detail(clipId),
    queryFn: () => api.clips.getClip({ params: { id: clipId } }),
  });
}

export function myClipsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: clipKeys.mine(),
    queryFn: ({ pageParam }) =>
      api.clips.listMyClips({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}
