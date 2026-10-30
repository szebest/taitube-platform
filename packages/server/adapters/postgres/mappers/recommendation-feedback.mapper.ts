import type { recommendationFeedback } from '@vp/db';
import type { RecommendationFeedback } from '@vp/domain';

type FeedbackRow = typeof recommendationFeedback.$inferSelect;

/** The table's check constraint sets exactly the column of the row's kind, so the other is never read. */
export function toFeedback({
  id,
  kind,
  videoId,
  channelId,
  createdAt,
}: FeedbackRow): RecommendationFeedback {
  return kind === 'not_interested'
    ? { id, kind, videoId: videoId ?? '', createdAt }
    : { id, kind, channelId: channelId ?? '', createdAt };
}
