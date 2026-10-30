import { useQuery } from '@tanstack/react-query';
import type { UserReaction } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi, useFailureToast } from '@vp/queries';

import { useSignIn } from '#app/features/auth/hooks/use-sign-in';

import { myReactionQueryOptions } from '../api/reaction-queries';
import { useSetReaction } from './use-set-reaction';

/**
 * The viewer's reaction to a video, and `change` to set it: a guest is sent to sign in, a failure toasts.
 * `likesCount` is the count the API last answered for this video, for a view that was not refetched.
 */
export function useReaction(videoId: string) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const signIn = useSignIn();
  const canReact = useCan('react', 'Video');

  const { data: mine } = useQuery({ ...myReactionQueryOptions(api, videoId), enabled: canReact });
  const setReaction = useSetReaction(videoId);

  const change = (next: UserReaction['reaction']) => {
    if (!canReact) {
      signIn();
      return;
    }

    const react = () =>
      setReaction.mutate(next ?? 'NONE', {
        onError: (error) => showFailure(tOr('watch.reactionFailed', {}, ''), error, react),
      });
    react();
  };

  const answered = setReaction.data?.videoId === videoId ? setReaction.data : undefined;

  return { reaction: mine?.reaction ?? null, change, likesCount: answered?.likesCount };
}
