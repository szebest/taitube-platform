import { act, renderHook } from '@testing-library/react';
import { stubEventSource } from '@vp/web-testing';

import { useLiveVideoEvents } from '../use-live-video-events';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000e002';
const STREAM_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

function renderEvents(videoId: string | null = VIDEO_ID) {
  const events = stubEventSource();
  const rendered = renderHook(() => useLiveVideoEvents(videoId));
  const emit = (name: string, data: unknown) => act(() => events.emit(name, data));
  return { ...rendered, events, emit };
}

describe('packages/queries: useLiveVideoEvents', () => {
  it("listens to the video's event stream through the app's /api", () => {
    const { events } = renderEvents();

    expect(events.urls).toEqual([`/api/v1/videos/${VIDEO_ID}/events`]);
  });

  it('opens nothing while there is no video', () => {
    const { events, result } = renderEvents(null);

    expect(events.urls).toEqual([]);
    expect(result.current).toEqual({ viewers: null, status: null, samples: [] });
  });

  it('takes the count from the snapshot and every viewers frame after it, keeping each sample', () => {
    const { emit, result } = renderEvents();

    emit('snapshot', { live: { liveStreamId: STREAM_ID, status: 'LIVE', viewers: 4 } });
    emit('live.viewers', { liveStreamId: STREAM_ID, viewers: 9 });

    expect(result.current).toMatchObject({ viewers: 9, status: 'LIVE' });
    expect(result.current.samples.map(({ viewers }) => viewers)).toEqual([4, 9]);
  });

  it.each([
    { frame: 'a status', name: 'live.status', data: { liveStreamId: STREAM_ID, status: 'ENDED' }, status: 'ENDED' },
    { frame: 'a snapshot of a recording', name: 'snapshot', data: { status: 'READY' }, status: null },
    { frame: 'a frame the contract refuses', name: 'live.status', data: { status: 'GONE' }, status: null },
  ])('reads $frame', ({ name, data, status }) => {
    const { emit, result } = renderEvents();

    emit(name, data);

    expect(result.current.status).toBe(status);
  });
});
