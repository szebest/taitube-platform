import { ErrorCodes } from '@vp/errors';
import { expectErr } from '@vp/testing/result';
import { aVideo } from '../../__tests__/entities';
import { decideWatchPartyShareable } from '../shareable.rule';

describe('@vp/domain-rules: decideWatchPartyShareable', () => {
  it.each([
    { scenario: 'a public video in a public room', video: {}, room: 'public' as const, ok: true },
    {
      scenario: 'an unlisted video in an unlisted room',
      video: { visibility: 'unlisted' as const },
      room: 'unlisted' as const,
      ok: true,
    },
    {
      scenario: 'an unlisted video in a private room',
      video: { visibility: 'unlisted' as const },
      room: 'private' as const,
      ok: true,
    },
  ])('shares $scenario', ({ video, room, ok }) => {
    expect(decideWatchPartyShareable('video-1', aVideo(video), room).ok).toBe(ok);
  });

  it.each([
    {
      scenario: 'a private video',
      video: { visibility: 'private' as const },
      room: 'private' as const,
      reason: 'private',
    },
    {
      scenario: 'an unlisted video in a public room',
      video: { visibility: 'unlisted' as const },
      room: 'public' as const,
      reason: 'unlisted',
    },
    {
      scenario: 'a live broadcast',
      video: { status: 'LIVE' as const },
      room: 'unlisted' as const,
      reason: 'live',
    },
    {
      scenario: 'a video still processing',
      video: { status: 'PROCESSING' as const },
      room: 'unlisted' as const,
      reason: 'not_ready',
    },
    {
      scenario: 'a deleted video',
      video: { deletedAt: new Date() },
      room: 'unlisted' as const,
      reason: 'missing',
    },
  ])('refuses $scenario', ({ video, room, reason }) => {
    expect(expectErr(decideWatchPartyShareable('video-1', aVideo(video), room))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
      reason,
    });
  });

  it('refuses a video that does not exist', () => {
    expect(expectErr(decideWatchPartyShareable('video-1', null, 'public')).reason).toBe('missing');
  });
});
