import type { Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { STRANGER, aVideo } from '../../__tests__/entities';
import { decideClipCreate } from '../create-clip.rule';

const input = (viewer: UserContext | null, video: Video | null, title = ' Goal ') => ({
  viewer,
  video,
  videoId: 'video-1',
  startMs: 10_000,
  endMs: 30_000,
  title,
});

const LONG = aVideo({ durationMs: 120_000 });

describe('@vp/domain-rules: decideClipCreate', () => {
  it('builds the clip of the signed-in viewer with a tidied title', () => {
    expect(expectOk(decideClipCreate(input(STRANGER, LONG)))).toEqual({
      videoId: 'video-1',
      userId: STRANGER.id,
      startMs: 10_000,
      endMs: 30_000,
      title: 'Goal',
    });
  });

  it.each([
    {
      scenario: 'a missing video',
      viewer: STRANGER,
      video: null,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a deleted video',
      viewer: STRANGER,
      video: aVideo({ status: 'DELETED' }),
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'an anonymous viewer',
      viewer: null,
      video: LONG,
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      scenario: 'a private video of someone else',
      viewer: STRANGER,
      video: aVideo({ visibility: 'private' }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'an unlisted video',
      viewer: STRANGER,
      video: aVideo({ visibility: 'unlisted', durationMs: 120_000 }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a video still transcoding',
      viewer: STRANGER,
      video: aVideo({ status: 'PROCESSING', durationMs: null }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a video shorter than the range',
      viewer: STRANGER,
      video: aVideo({ durationMs: 20_000 }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ viewer, video, code }) => {
    expect(expectErr(decideClipCreate(input(viewer, video))).code).toBe(code);
  });

  it('refuses a blank title', () => {
    expect(expectErr(decideClipCreate(input(STRANGER, LONG, '  '))).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });
});
