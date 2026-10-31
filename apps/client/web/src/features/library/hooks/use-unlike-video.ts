import type { ApiClient } from '@vp/api-client';
import { useApi, videoQueryOptions } from '@vp/queries';

import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';

import { likedVideosQueryOptions } from '../api/library-queries';
import { dropItems } from '../api/paged-list';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

/** Unlike is the reaction `NONE`; the liked list drops the video at once. */
function unlikeVideoMutationOptions(api: ApiClient, videoId: string) {
  const key = likedVideosQueryOptions(api).queryKey;

  return queryMutationOptions({
    key,
    request: () => api.reactions.setReaction({ params: { id: videoId }, body: { type: 'NONE' } }),
    edit: (data) => dropItems(data, (video) => video.id === videoId),
    invalidate: [
      key,
      myReactionQueryOptions(api, videoId).queryKey,
      videoQueryOptions(api, videoId).queryKey,
    ],
  });
}

export function useUnlikeVideo(videoId: string) {
  const api = useApi();
  return useListMutation(unlikeVideoMutationOptions(api, videoId));
}
