import { ErrorCodes, isInputFailure } from '@vp/errors';
import { recommendationFeedbackNotFound } from '../failures';

describe('@vp/domain-rules: recommendation feedback failures', () => {
  it('names the row that is not the caller own, off the wire', () => {
    const failure = recommendationFeedbackNotFound('f1');

    expect(failure).toMatchObject({
      code: ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND,
      feedbackId: 'f1',
    });
    expect(isInputFailure(failure)).toBe(false);
  });
});
