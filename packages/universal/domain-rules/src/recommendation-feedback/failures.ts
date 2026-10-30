import { ErrorCodes, type Failure } from '@vp/errors';

export type RecommendationFeedbackNotFound = Failure<
  typeof ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND,
  { feedbackId: string }
>;

export function recommendationFeedbackNotFound(feedbackId: string): RecommendationFeedbackNotFound {
  return {
    code: ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND,
    message: 'Recommendation feedback not found',
    feedbackId,
  };
}
