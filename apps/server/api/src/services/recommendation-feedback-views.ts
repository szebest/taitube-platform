import type { RecommendationFeedbackItemView, RecommendationFeedbackView } from '@vp/api-contracts';
import type { RecommendationFeedback, RecommendationFeedbackEntry } from '@vp/domain';
import { type SpriteGeometry, toVideoSummaryView } from './video-views';
import type { CdnBase } from '@vp/env-schema';

export function toRecommendationFeedbackView(
  feedback: RecommendationFeedback
): RecommendationFeedbackView {
  const createdAt = feedback.createdAt.toISOString();
  return feedback.kind === 'not_interested'
    ? { id: feedback.id, kind: feedback.kind, videoId: feedback.videoId, createdAt }
    : { id: feedback.id, kind: feedback.kind, channelId: feedback.channelId, createdAt };
}

export function toRecommendationFeedbackItemView(
  entry: RecommendationFeedbackEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): RecommendationFeedbackItemView {
  const { channel } = entry;
  const createdAt = entry.createdAt.toISOString();
  return entry.kind === 'not_interested'
    ? {
        id: entry.id,
        kind: entry.kind,
        videoId: entry.videoId,
        createdAt,
        video: entry.video && toVideoSummaryView(entry.video, cdn, sprite, channel),
        channel,
      }
    : { id: entry.id, kind: entry.kind, channelId: entry.channelId, createdAt, channel };
}
