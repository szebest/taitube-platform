import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { STRANGER, aVideo } from '../../__tests__/entities';
import { decideReact } from '../react.rule';

const video = aVideo();

describe('@vp/domain-rules: decideReact', () => {
  it('lets a signed-in viewer react to a readable video', () => {
    expect(isOk(decideReact({ reactor: STRANGER, video, videoId: video.id }))).toBe(true);
  });

  it('refuses an anonymous reactor on a public video', () => {
    const result = decideReact({ reactor: null, video, videoId: video.id });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('composes the read rule, so an absent video is still VIDEO_NOT_FOUND', () => {
    const result = decideReact({ reactor: STRANGER, video: null, videoId: 'gone' });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('refuses a reaction to a video the reactor may not read', () => {
    const result = decideReact({
      reactor: STRANGER,
      video: aVideo({ visibility: 'private' }),
      videoId: video.id,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });
});
