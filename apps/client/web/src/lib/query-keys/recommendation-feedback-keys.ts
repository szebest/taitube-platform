import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export const recommendationFeedbackKeys = {
  all: ['recommendation-feedback'] as const,
  list: () => [...recommendationFeedbackKeys.all, 'list'] as const,
};

/** What the viewer told the recommendations not to show, newest first. */
export function hiddenRecommendationsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: recommendationFeedbackKeys.list(),
    queryFn: ({ pageParam }) =>
      api.recommendationFeedback.listRecommendationFeedback({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
