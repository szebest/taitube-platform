import type { Clip } from '@vp/domain';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideClipRead } from '../read-clip.rule';

const CLIP: Clip = {
  id: 'clip-1',
  videoId: 'video-1',
  userId: STRANGER.id,
  startMs: 0,
  endMs: 20_000,
  title: 'Goal',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('@vp/domain-rules: decideClipRead', () => {
  it.each([
    { who: 'an anonymous viewer', viewer: null, video: aVideo() },
    { who: 'a stranger', viewer: STRANGER, video: aVideo({ visibility: 'unlisted' }) },
    { who: 'the video owner', viewer: OWNER, video: aVideo({ visibility: 'private' }) },
    { who: 'an admin', viewer: ADMIN, video: aVideo({ visibility: 'private' }) },
  ])('lets $who read a clip of a video they can watch', ({ viewer, video }) => {
    expect(expectOk(decideClipRead({ viewer, clip: CLIP, video, clipId: 'clip-1' }))).toBe(CLIP);
  });

  it.each([
    { scenario: 'a missing clip', clip: null, video: aVideo(), viewer: null },
    { scenario: 'a missing video', clip: CLIP, video: null, viewer: null },
    {
      scenario: 'a video made private',
      clip: CLIP,
      video: aVideo({ visibility: 'private' }),
      viewer: null,
    },
    {
      scenario: 'a private video, for the clip creator',
      clip: CLIP,
      video: aVideo({ visibility: 'private' }),
      viewer: STRANGER,
    },
    {
      scenario: 'a deleted video',
      clip: CLIP,
      video: aVideo({ status: 'DELETED' }),
      viewer: OWNER,
    },
    {
      scenario: 'a soft-deleted video',
      clip: CLIP,
      video: aVideo({ deletedAt: new Date('2026-02-01T00:00:00.000Z') }),
      viewer: OWNER,
    },
  ])('answers $scenario as not found', ({ clip, video, viewer }) => {
    expect(expectErr(decideClipRead({ viewer, clip, video, clipId: 'clip-1' }))).toMatchObject({
      code: 'CLIP_NOT_FOUND',
      clipId: 'clip-1',
    });
  });
});
