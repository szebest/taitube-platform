import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidScreeningFinding } from '../failures';

describe('@vp/domain-rules: screening failures', () => {
  it('names the reason and the score, off the wire', () => {
    const failure = invalidScreeningFinding('NSFW', 1.5);

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      reason: 'NSFW',
      score: 1.5,
    });
    expect(isInputFailure(failure)).toBe(false);
  });
});
