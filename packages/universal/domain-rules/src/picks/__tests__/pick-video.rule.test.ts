import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aVideo } from '../../__tests__/entities';
import { decidePickVideo } from '../pick-video.rule';

describe('@vp/domain-rules: decidePickVideo', () => {
  it('accepts a public, ready video', () => {
    const video = aVideo();

    expect(expectOk(decidePickVideo(video, video.id))).toBe(video);
  });

  it.each([
    { name: 'an absent video', video: null },
    { name: 'a deleted video', video: aVideo({ status: 'DELETED' }) },
  ])('reports $name as not found', ({ video }) => {
    expect(expectErr(decidePickVideo(video, 'v1'))).toMatchObject({
      code: ErrorCodes.VIDEO_NOT_FOUND,
      videoId: 'v1',
    });
  });

  it.each([
    { name: 'a private video', video: aVideo({ visibility: 'private' }) },
    { name: 'an unlisted video', video: aVideo({ visibility: 'unlisted' }) },
    { name: 'a video still processing', video: aVideo({ status: 'PROCESSING' }) },
  ])('refuses $name and names videoId', ({ video }) => {
    expect(expectErr(decidePickVideo(video, video.id))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'videoId',
    });
  });
});
