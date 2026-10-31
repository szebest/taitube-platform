import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractResult, listAdminVideos } from '@vp/api-contracts';

import { adminVideoKeys } from './admin-videos';

export type PickableVideo = ContractResult<typeof listAdminVideos>['items'][number];

export type PickVideo = Pick<
  PickableVideo,
  'id' | 'title' | 'thumbnailUrl' | 'posterUrl' | 'channel'
>;

const PICKABLE_LIMIT = 20;

/** The first page of public, ready videos whose title holds `text`: the only kind a pick accepts. */
export function pickableVideosQueryOptions(api: ApiClient, text: string) {
  const q = text.trim() || undefined;

  return queryOptions({
    queryKey: [...adminVideoKeys.all, 'pickable', q] as const,
    queryFn: async () =>
      (
        await api.adminVideos.listAdminVideos({
          query: { visibility: 'public', status: 'READY', q, limit: PICKABLE_LIMIT },
        })
      ).items,
  });
}
