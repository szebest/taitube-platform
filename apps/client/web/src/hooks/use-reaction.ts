import { useQuery } from '@tanstack/react-query';
import type { UserReaction } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi, useFailureToast } from '@vp/queries';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { isQueuedByWorker } from '#app/integrations/service-worker-client/is-queued-by-worker';
import { myReactionQueryOptions } from '#app/lib/query-keys/reaction-keys';
import { useSetReaction } from './use-set-reaction';

/**
 * The viewer's reaction to a video, and `change` to set it: a guest gets the sign-in prompt, a failure toasts.
 * `likesCount` is the count the API last answered for this video, for a view that was not refetched.
 */
export function useReaction(videoId: string) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const like = useRequireAccount('like');
  const dislike = useRequireAccount('dislike');
  const canReact = like.allowed;

  const { data: mine } = useQuery({ ...myReactionQueryOptions(api, videoId), enabled: canReact });
  const setReaction = useSetReaction(videoId);

  const change = (next: UserReaction['reaction']) => {
    const react = () =>
      setReaction.mutate(next ?? 'NONE', {
        onError: (error) => {
          if (!isQueuedByWorker(error)) {
            showFailure(tOr('watch.reactionFailed', {}, ''), error, react);
          }
        },
      });
    if (next === 'DISLIKE') {
      dislike.run(react);
    } else {
      like.run(react, next === 'LIKE' ? { kind: 'like', id: videoId } : undefined);
    }
  };

  const answered = setReaction.data?.videoId === videoId ? setReaction.data : undefined;

  return { reaction: mine?.reaction ?? null, change, likesCount: answered?.likesCount };
}
