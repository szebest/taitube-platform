import type { LiveStream } from '@vp/domain';
import { toChannelView } from '../channel-views';
import { aChannel, aLiveStream, STREAM_ID, VIDEO_ID } from './live-harness';

const STATS = { subscriberCount: 3, videoCount: 1, totalViews: 9 };

const liveOf = (open: LiveStream | null) => toChannelView(aChannel(), STATS, open).live;

describe('apps/server/api/services: channel views', () => {
  it('puts a public broadcast on the channel', () => {
    expect(liveOf(aLiveStream())).toEqual({
      liveStreamId: STREAM_ID,
      videoId: VIDEO_ID,
      startedAt: '2026-03-01T12:00:00.000Z',
    });
  });

  it.each([
    { scenario: 'no open stream', open: null },
    {
      scenario: 'an idle stream',
      open: aLiveStream({ status: 'IDLE', videoId: null, startedAt: null }),
    },
    { scenario: 'an unlisted broadcast', open: aLiveStream({ visibility: 'unlisted' }) },
    { scenario: 'a private broadcast', open: aLiveStream({ visibility: 'private' }) },
  ])('shows no live dot for $scenario', ({ open }) => {
    expect(liveOf(open)).toBeNull();
  });
});
