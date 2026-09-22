import { ErrorCodes, isInputFailure } from '@vp/errors';
import { reactionForbidden } from '../failures';

describe('@vp/domain-rules: reaction failures', () => {
  it('reports a forbidden reaction with the video id', () => {
    expect(reactionForbidden('v1')).toMatchObject({
      code: ErrorCodes.FORBIDDEN,
      videoId: 'v1',
    });
  });

  it('stays off the wire', () => {
    expect(isInputFailure(reactionForbidden('v1'))).toBe(false);
  });
});
