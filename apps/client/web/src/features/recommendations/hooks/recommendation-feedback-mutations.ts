import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type {
  HomeResponse,
  ReasonedVideo,
  RecommendationFeedbackBody,
  RecommendationFeedbackView,
} from '@vp/api-contracts';
import { applyFeedback, type HiddenFeedback, withoutHidden } from '@vp/domain';

import { homeKeys } from '#app/features/home/api/home-queries';
import { relatedKeys } from '#app/features/watch/api/related-queries';
import { recommendationFeedbackKeys } from '../api/recommendation-feedback-queries';

type RelatedResponse = { items: ReasonedVideo[] };

export interface PutFeedbackNotices {
  saved: (feedback: RecommendationFeedbackView) => void;
  failed: () => void;
}

function hiddenBy(body: RecommendationFeedbackBody): HiddenFeedback {
  return body.kind === 'not_interested'
    ? { videoIds: new Set([body.videoId]), channelIds: new Set() }
    : { videoIds: new Set(), channelIds: new Set([body.channelId]) };
}

function invalidateRecommendations(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: homeKeys.shelves() }),
    client.invalidateQueries({ queryKey: relatedKeys.all }),
    client.invalidateQueries({ queryKey: recommendationFeedbackKeys.all }),
  ]);
}

/**
 * Puts the feedback. The card leaves the home shelves and "More like this" before the answer, and
 * comes back if the write fails. The notices are options-level so they fire after the card, and the
 * hook that called `mutate`, are gone.
 */
export function putFeedbackMutationOptions(api: ApiClient, notices: PutFeedbackNotices) {
  return mutationOptions({
    mutationFn: (body: RecommendationFeedbackBody) =>
      api.recommendationFeedback.putRecommendationFeedback({ body }),
    onMutate: async (body, { client }) => {
      await client.cancelQueries({ queryKey: homeKeys.shelves() });
      await client.cancelQueries({ queryKey: relatedKeys.all });
      const homes = client.getQueriesData<HomeResponse>({ queryKey: homeKeys.shelves() });
      const related = client.getQueriesData<RelatedResponse>({ queryKey: relatedKeys.all });

      const hidden = hiddenBy(body);
      client.setQueriesData<HomeResponse>(
        { queryKey: homeKeys.shelves() },
        (page) => page && { shelves: applyFeedback(page.shelves, hidden) }
      );
      client.setQueriesData<RelatedResponse>(
        { queryKey: relatedKeys.all },
        (page) => page && { items: withoutHidden(page.items, hidden) }
      );
      return { snapshots: [...homes, ...related] };
    },
    onSuccess: (feedback) => notices.saved(feedback),
    onError: (_error, _body, context, { client }) => {
      for (const [key, data] of context?.snapshots ?? []) {
        if (data !== undefined) client.setQueryData(key, data);
      }
      notices.failed();
    },
    onSettled: (_data, _error, _body, _context, { client }) => invalidateRecommendations(client),
  });
}

/** Undo: the video and its channel are recommended again from the next build. */
export function undoFeedbackMutationOptions(api: ApiClient, failed: () => void) {
  return mutationOptions({
    mutationFn: (feedbackId: string) =>
      api.recommendationFeedback.removeRecommendationFeedback({ params: { id: feedbackId } }),
    onError: failed,
    onSettled: (_data, _error, _id, _context, { client }) => invalidateRecommendations(client),
  });
}
