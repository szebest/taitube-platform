import { useMutation } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { putFeedbackMutationOptions } from '#app/lib/query-keys/recommendation-feedback-mutations';
import { useUndoRecommendationFeedback } from './use-undo-recommendation-feedback';

export interface RecommendationFeedbackActions {
  hideVideo: (videoId: string) => void;
  hideChannel: (channelId: string) => void;
}

/** "Not interested" and "Don't recommend this channel": the card goes at once and a toast offers Undo, and a guest gets the sign-in prompt. */
export function useRecommendationFeedback(): RecommendationFeedbackActions {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();
  const { mutate: undo } = useUndoRecommendationFeedback();
  const { run } = useRequireAccount('feedback');

  const { mutate } = useMutation(
    putFeedbackMutationOptions(api, {
      saved: ({ id }) =>
        showToast({
          tone: 'success',
          title: tOr('home.feedbackSaved', {}, ''),
          action: { label: tOr('home.feedbackUndo', {}, ''), onAction: () => undo(id) },
        }),
      failed: () => showToast({ tone: 'danger', title: tOr('home.feedbackFailed', {}, '') }),
    })
  );

  return {
    hideVideo: (videoId) => run(() => mutate({ kind: 'not_interested', videoId })),
    hideChannel: (channelId) => run(() => mutate({ kind: 'hide_channel', channelId })),
  };
}
