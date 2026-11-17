import { useT } from '@kit/intl-react';
import { useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { undoFeedbackMutationOptions } from '#app/lib/query-keys/recommendation-feedback-mutations';

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
