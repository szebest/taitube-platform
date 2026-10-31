import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideRecommendationFeedbackRemoval } from '../remove-recommendation-feedback.rule';

describe('@vp/domain-rules: decideRecommendationFeedbackRemoval', () => {
  it('accepts a removal that deleted a row', () => {
    expectOk(decideRecommendationFeedbackRemoval({ feedbackId: 'f1', removed: true }));
  });

  it('is not found when nothing of the caller went', () => {
    expect(
      expectErr(decideRecommendationFeedbackRemoval({ feedbackId: 'f1', removed: false }))
    ).toMatchObject({ code: ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND, feedbackId: 'f1' });
  });
});
