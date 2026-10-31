import { useMutation } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import { putFeedbackMutationOptions } from './recommendation-feedback-mutations';
import { useUndoRecommendationFeedback } from './use-undo-recommendation-feedback';

export interface RecommendationFeedbackActions {
  hideVideo: (videoId: string) => void;
  hideChannel: (channelId: string) => void;
}

/** "Not interested" and "Don't recommend this channel": the card goes at once and a toast offers Undo. */
export function useRecommendationFeedback(): RecommendationFeedbackActions {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();
  const { mutate: undo } = useUndoRecommendationFeedback();

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
    hideVideo: (videoId) => mutate({ kind: 'not_interested', videoId }),
    hideChannel: (channelId) => mutate({ kind: 'hide_channel', channelId }),
  };
}
