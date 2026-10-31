import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aVideo } from '../../__tests__/entities';
import { decideOEmbedVideo } from '../oembed-video.rule';

describe('@vp/domain-rules: decideOEmbedVideo', () => {
  it('accepts a public, ready video', () => {
    const video = aVideo();

    expect(expectOk(decideOEmbedVideo(video, video.id))).toBe(video);
  });

  it.each([
    { name: 'an absent video', video: null },
    { name: 'a private video', video: aVideo({ visibility: 'private' }) },
    { name: 'an unlisted video', video: aVideo({ visibility: 'unlisted' }) },
    { name: 'a video still processing', video: aVideo({ status: 'PROCESSING' }) },
    { name: 'a failed video', video: aVideo({ status: 'FAILED' }) },
    { name: 'a deleted video', video: aVideo({ status: 'DELETED' }) },
    { name: 'a soft-deleted video', video: aVideo({ deletedAt: new Date() }) },
  ])('answers $name as not found', ({ video }) => {
    expect(expectErr(decideOEmbedVideo(video, 'v1'))).toMatchObject({
      code: ErrorCodes.VIDEO_NOT_FOUND,
      videoId: 'v1',
    });
  });
});
