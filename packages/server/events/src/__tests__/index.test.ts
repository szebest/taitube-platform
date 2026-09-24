import { cacheUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { publishVideoEvent, userChannel, videoChannel } from '../index';

const VIDEO_ID = '11111111-1111-7111-8111-111111111111';
const USER_ID = '22222222-2222-7222-8222-222222222222';

describe('@vp/events', () => {
  it('publishes to the video and its owner, and sums who heard it', async () => {
    const publish = vi.fn(async (_channel: string, _message: string) => ok(2));

    const published = await publishVideoEvent({
      cache: { publish },
      videoId: VIDEO_ID,
      userId: USER_ID,
      event: 'status',
      data: { status: 'READY' },
      ts: 1,
    });

    expect(published).toEqual(ok(4));
    expect(publish.mock.calls.map(([channel]) => channel)).toEqual([
      videoChannel(VIDEO_ID),
      userChannel(USER_ID),
    ]);
  });

  it('returns the failure of a channel that refused the event', async () => {
    const refused = cacheUnavailable('publish');
    const publish = vi.fn().mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(err(refused));

    expect(
      await publishVideoEvent({
        cache: { publish },
        videoId: VIDEO_ID,
        userId: USER_ID,
        event: 'progress',
        data: { percent: 10 },
        ts: 1,
      })
    ).toEqual(err(refused));
  });
});
