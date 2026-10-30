import { useQuery } from '@tanstack/react-query';
import type { UserReaction } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import { useSignIn } from '#app/features/auth/hooks/use-sign-in';

import { myReactionQueryOptions } from '../api/reaction-queries';
import { useSetReaction } from './use-set-reaction';

/** The viewer's reaction to a video, and `change` to set it: a guest is sent to sign in, a failure toasts. */
export function useReaction(videoId: string) {
  const api = useApi();
  const { tOr } = useT();
  const showToast = useToast();
  const signIn = useSignIn();
  const canReact = useCan('react', 'Video');

  const { data: mine } = useQuery({ ...myReactionQueryOptions(api, videoId), enabled: canReact });
  const setReaction = useSetReaction(videoId);

  const change = (next: UserReaction['reaction']) => {
    if (!canReact) {
      signIn();
      return;
    }

    setReaction.mutate(next ?? 'NONE', {
      onError: () => showToast({ tone: 'danger', title: tOr('watch.reactionFailed', {}, '') }),
    });
  };

  return { reaction: mine?.reaction ?? null, change };
}
