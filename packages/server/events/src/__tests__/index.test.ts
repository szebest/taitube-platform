import { cacheUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { publishVideoEvent, videoChannel } from '../index';

const VIDEO_ID = '11111111-1111-7111-8111-111111111111';

describe('@vp/events', () => {
  it.each([
    ['how many heard it', ok(2)],
    ['the failure of a channel that refused it', err(cacheUnavailable('publish'))],
  ])('publishes on the video channel and returns %s', async (_label, answer) => {
    const publish = vi.fn(async (_channel: string, _message: string) => answer);

    const published = await publishVideoEvent({
      cache: { publish },
      videoId: VIDEO_ID,
      event: 'status',
      data: { status: 'READY' },
      ts: 1,
    });

    expect(published).toEqual(answer);
    expect(publish.mock.calls.map(([channel]) => channel)).toEqual([videoChannel(VIDEO_ID)]);
  });
});
