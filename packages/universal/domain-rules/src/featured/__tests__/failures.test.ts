import { ErrorCodes, isInputFailure } from '@vp/errors';
import { featuredVideoNotPublic } from '../failures';

describe('@vp/domain-rules: featured video failures', () => {
  it('names the field and the video, and is wire-safe', () => {
    const failure = featuredVideoNotPublic('v1', 'private');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'videoIds',
      videoId: 'v1',
      visibility: 'private',
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
