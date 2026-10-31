import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ReactionInput, UserReaction, Video } from '@vp/api-contracts';
import { useApi, videoQueryOptions } from '@vp/queries';

import { isQueuedByWorker } from '#app/features/offline/is-queued-by-worker';
import { restoreQueryData } from '#app/integrations/query/restore-query-data';

import { myReactionQueryOptions } from '../api/reaction-queries';

type Reaction = UserReaction['reaction'];

function tally(reaction: Reaction, counted: NonNullable<Reaction>): number {
  return reaction === counted ? 1 : 0;
}

function recount(video: Video, from: Reaction, to: Reaction): Video {
  return {
    ...video,
    likesCount: video.likesCount - tally(from, 'LIKE') + tally(to, 'LIKE'),
    dislikesCount: video.dislikesCount - tally(from, 'DISLIKE') + tally(to, 'DISLIKE'),
  };
}

function setReactionMutationOptions(api: ApiClient, videoId: string) {
  const reactionKey = myReactionQueryOptions(api, videoId).queryKey;
  const videoKey = videoQueryOptions(api, videoId).queryKey;

  return mutationOptions({
    mutationFn: (type: ReactionInput['type']) =>
      api.reactions.setReaction({ params: { id: videoId }, body: { type } }),
    onMutate: async (type, { client }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: reactionKey }),
        client.cancelQueries({ queryKey: videoKey }),
      ]);
      const previousReaction = client.getQueryData(reactionKey);
      const previousVideo = client.getQueryData(videoKey);
      const reaction = type === 'NONE' ? null : type;

      client.setQueryData(reactionKey, { videoId, reaction });
      if (previousVideo) {
        client.setQueryData(
          videoKey,
          recount(previousVideo, previousReaction?.reaction ?? null, reaction)
        );
      }
      return { previousReaction, previousVideo };
    },
    onError: (error, _type, snapshot, { client }) => {
      if (isQueuedByWorker(error)) {
        return;
      }
      restoreQueryData(client, reactionKey, snapshot?.previousReaction);
      restoreQueryData(client, videoKey, snapshot?.previousVideo);
    },
    onSettled: (_data, error, _type, _snapshot, { client }) =>
      !isQueuedByWorker(error) &&
      Promise.all([
        client.invalidateQueries({ queryKey: reactionKey }),
        client.invalidateQueries({ queryKey: videoKey }),
      ]),
  });
}

export function useSetReaction(videoId: string) {
  const api = useApi();
  return useMutation(setReactionMutationOptions(api, videoId));
}
