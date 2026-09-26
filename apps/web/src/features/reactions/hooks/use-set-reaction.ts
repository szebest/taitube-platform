import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ReactionInput, UserReaction, Video } from '@vp/api-contracts';

import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { apiClient } from '#app/integrations/api/api-client';
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

export function setReactionMutationOptions(videoId: string) {
  const reactionKey = myReactionQueryOptions(videoId).queryKey;
  const videoKey = videoQueryOptions(videoId).queryKey;

  return mutationOptions({
    mutationFn: (type: ReactionInput['type']) =>
      apiClient.reactions.setReaction({ params: { id: videoId }, body: { type } }),
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
        client.setQueryData(videoKey, recount(previousVideo, previousReaction?.reaction ?? null, reaction));
      }
      return { previousReaction, previousVideo };
    },
    onError: (_error, _type, snapshot, { client }) => {
      restoreQueryData(client, reactionKey, snapshot?.previousReaction);
      restoreQueryData(client, videoKey, snapshot?.previousVideo);
    },
    onSettled: (_data, _error, _type, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: reactionKey }),
        client.invalidateQueries({ queryKey: videoKey }),
      ]),
  });
}

export function useSetReaction(videoId: string) {
  return useMutation(setReactionMutationOptions(videoId));
}
