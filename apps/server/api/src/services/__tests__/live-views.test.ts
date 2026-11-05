import type { LiveStream } from '@vp/domain';
import { toLiveStreamView } from '../live-views';
import { aChannel, aLiveStream, STARTED } from './live-harness';
import { TEST_CDN } from './service-deps';

const view = (stream: Partial<LiveStream>, recordingReady = false) =>
  toLiveStreamView(
    {
      stream: aLiveStream({ chatSlowModeSeconds: 30, ...stream }),
      channel: aChannel(),
      viewers: 7,
      recordingReady,
    },
    TEST_CDN
  );

describe('apps/server/api/services: live views', () => {
  it('plays a live broadcast from its master playlist, titled after the channel when untitled', () => {
    expect(view({})).toMatchObject({
      title: 'Night Kitchen',
      viewers: 7,
      playbackUrl: expect.stringMatching(/\/public\/live\/[\w-]+\/master\.m3u8$/),
      chat: { slowModeSeconds: 30, subscribersOnly: false },
    });
  });

  it.each([
    { scenario: 'still packaging', recordingReady: false, playable: false },
    { scenario: 'ready', recordingReady: true, playable: true },
  ])(
    'counts nobody on an ended broadcast whose recording is $scenario',
    ({ recordingReady, playable }) => {
      const ended = view({ status: 'ENDED', endedAt: STARTED }, recordingReady);

      expect([ended.viewers, ended.playbackUrl !== null]).toEqual([0, playable]);
    }
  );
});
