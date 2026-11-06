import type { UserEvent } from '@vp/api-contracts';
import { streamUserEvents } from '../user-events';

const FAILED: UserEvent = {
  type: 'captions.failed',
  payload: { videoId: 'v1', captionId: 'c1', reason: 'no speech' },
};

function openStream() {
  const stream = streamUserEvents();
  const heard: unknown[] = [];
  const source = new EventSource('/api/v1/me/events');
  source.addEventListener(FAILED.type, ({ data }) => heard.push(JSON.parse(String(data))));
  return { stream, heard };
}

describe('@vp/web-testing: streamUserEvents', () => {
  it('grants the stream lock at once and delivers a sent event under its type', async () => {
    const { stream, heard } = openStream();
    const granted = await navigator.locks.request(
      'vp.user-events',
      { ifAvailable: true },
      (lock) => lock?.name
    );

    stream.send(FAILED);

    expect(granted).toBe('vp.user-events');
    expect(heard).toEqual([FAILED]);
  });
});
