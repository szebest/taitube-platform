import type { Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideFeaturedVideos, isFeaturable } from '../featured-videos.rule';

const A = aVideo({ id: 'a' });
const B = aVideo({ id: 'b' });

const catalogue = (...videos: Video[]) => new Map(videos.map((video) => [video.id, video]));

describe('@vp/domain-rules: decideFeaturedVideos', () => {
  it('answers the ids in the order given', () => {
    const decided = decideFeaturedVideos({
      viewer: OWNER,
      channelOwnerId: OWNER.id,
      videoIds: ['b', 'a'],
      videos: catalogue(A, B),
    });

    expect(expectOk(decided)).toEqual(['b', 'a']);
  });

  it('accepts an empty list', () => {
    const decided = decideFeaturedVideos({
      viewer: OWNER,
      channelOwnerId: OWNER.id,
      videoIds: [],
      videos: catalogue(),
    });

    expect(expectOk(decided)).toEqual([]);
  });

  it.each([
    {
      scenario: 'an id no video has',
      viewer: OWNER,
      videos: catalogue(),
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a deleted video',
      viewer: OWNER,
      videos: catalogue(aVideo({ id: 'a', status: 'DELETED' })),
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a private video of someone else, which the caller cannot know of',
      viewer: STRANGER,
      videos: catalogue(aVideo({ id: 'a', visibility: 'private' })),
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a public video of another creator',
      viewer: STRANGER,
      videos: catalogue(A),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a public video of another creator, as an admin',
      viewer: ADMIN,
      videos: catalogue(A),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'no signed-in caller',
      viewer: null,
      videos: catalogue(A),
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      scenario: 'a video still processing',
      viewer: OWNER,
      videos: catalogue(aVideo({ id: 'a', status: 'PROCESSING' })),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a private video of the owner',
      viewer: OWNER,
      videos: catalogue(aVideo({ id: 'a', visibility: 'private' })),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'an unlisted video of the owner',
      viewer: OWNER,
      videos: catalogue(aVideo({ id: 'a', visibility: 'unlisted' })),
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ viewer, videos, code }) => {
    const decided = decideFeaturedVideos({
      viewer,
      channelOwnerId: viewer?.id ?? OWNER.id,
      videoIds: ['a'],
      videos,
    });

    expect(expectErr(decided).code).toBe(code);
  });

  it('names the first video that fails, not the later ones', () => {
    const decided = decideFeaturedVideos({
      viewer: OWNER,
      channelOwnerId: OWNER.id,
      videoIds: ['a', 'b', 'c'],
      videos: catalogue(A, aVideo({ id: 'b', visibility: 'private' })),
    });

    expect(expectErr(decided)).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, videoId: 'b' });
  });
});

describe('@vp/domain-rules: isFeaturable', () => {
  it.each([
    { scenario: 'a ready public video', video: A, expected: true },
    { scenario: 'a private one', video: aVideo({ visibility: 'private' }), expected: false },
    { scenario: 'an unlisted one', video: aVideo({ visibility: 'unlisted' }), expected: false },
    { scenario: 'one still processing', video: aVideo({ status: 'PROCESSING' }), expected: false },
    { scenario: 'a deleted one', video: aVideo({ status: 'DELETED' }), expected: false },
  ])('$scenario: $expected', ({ video, expected }) => {
    expect(isFeaturable(video)).toBe(expected);
  });
});
