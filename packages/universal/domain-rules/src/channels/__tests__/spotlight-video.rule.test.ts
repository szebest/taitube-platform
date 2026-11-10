import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER, aVideo } from '../../__tests__/entities';
import { decideSpotlightVideo, isSpotlightable } from '../spotlight-video.rule';

const own = (overrides = {}) => aVideo({ ownerId: OWNER.id, ...overrides });

describe('@vp/domain-rules: spotlight video', () => {
  it.each([
    { scenario: 'the own public ready video', video: own(), problem: null },
    { scenario: 'no video', video: null, problem: 'missing' },
    { scenario: 'a deleted video', video: own({ status: 'DELETED' }), problem: 'missing' },
    {
      scenario: 'another channel video',
      video: aVideo({ ownerId: 'someone-else' }),
      problem: 'not-owned',
    },
    {
      scenario: 'a video still processing',
      video: own({ status: 'PROCESSING' }),
      problem: 'not-ready',
    },
    { scenario: 'a private video', video: own({ visibility: 'private' }), problem: 'not-public' },
    {
      scenario: 'an unlisted video',
      video: own({ visibility: 'unlisted' }),
      problem: 'not-public',
    },
  ])('judges $scenario: $problem', ({ video, problem }) => {
    expect(isSpotlightable(video, OWNER.id)).toBe(problem === null);

    const decided = decideSpotlightVideo('trailerVideoId', 'video-1', video, OWNER.id);
    if (problem === null) {
      expect(expectOk(decided).id).toBe('video-1');
    } else {
      expect(expectErr(decided)).toMatchObject({
        code: 'INVALID_SPOTLIGHT_VIDEO',
        field: 'trailerVideoId',
        videoId: 'video-1',
        problem,
      });
    }
  });
});
