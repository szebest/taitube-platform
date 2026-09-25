import { ErrorCodes } from '@vp/errors';
import { analyticsForbidden } from '../failures';

describe('@vp/domain-rules: analytics failures', () => {
  it('refuses as a readable FORBIDDEN, which the public edge keeps a 403', () => {
    expect(analyticsForbidden('video-1')).toEqual({
      code: ErrorCodes.FORBIDDEN,
      message: 'Only the video owner can read its analytics',
      videoId: 'video-1',
      readable: true,
    });
  });
});
