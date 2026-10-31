import { err, ok, type Result } from '@vp/result';
import { type RecommendationFeedbackNotFound, recommendationFeedbackNotFound } from './failures';

export interface RemoveRecommendationFeedbackInput {
  readonly feedbackId: string;
  /** Whether a row of the caller's own went; another user's id deletes nothing, so it is not found. */
  readonly removed: boolean;
}

export function decideRecommendationFeedbackRemoval(
  input: RemoveRecommendationFeedbackInput
): Result<void, RecommendationFeedbackNotFound> {
  return input.removed ? ok() : err(recommendationFeedbackNotFound(input.feedbackId));
}
