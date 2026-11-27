import { ErrorCodes } from '@vp/errors';
import { revisionNotFound } from '../failures';

describe('@vp/domain-rules: revision failures', () => {
  it('names the video and the missing revision', () => {
    expect(revisionNotFound('v1', 'r1')).toMatchObject({
      code: ErrorCodes.REVISION_NOT_FOUND,
      videoId: 'v1',
      revisionId: 'r1',
    });
  });
});
