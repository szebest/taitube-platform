import { useMutation } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import { undoFeedbackMutationOptions } from './recommendation-feedback-mutations';

export function useUndoRecommendationFeedback() {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useMutation(
    undoFeedbackMutationOptions(api, () =>
      showToast({ tone: 'danger', title: tOr('home.feedbackUndoFailed', {}, '') })
    )
  );
}
