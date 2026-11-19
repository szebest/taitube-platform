import { sendJsonBeacon } from '@kit/web-telemetry';
import { renderHook } from '@testing-library/react';
import { usePlaybackTelemetry } from '../use-playback-telemetry';

vi.mock(import('@kit/web-telemetry'), async (importOriginal) => ({
  ...(await importOriginal()),
  sendJsonBeacon: vi.fn(),
}));

const VIDEO_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PROGRESS = { currentTime: 3, duration: 60 };

const sent = () => vi.mocked(sendJsonBeacon).mock.calls.map(([url, event]) => ({ url, event }));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function reportPointer(coarse: boolean, screen: { width: number; height: number }) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) => ({ matches: coarse && query === '(pointer: coarse)' }) as MediaQueryList
  );
  vi.spyOn(window, 'screen', 'get').mockReturnValue(screen as Screen);
}

describe('apps/client/web: usePlaybackTelemetry', () => {
  beforeEach(() => {
    reportPointer(false, { width: 1920, height: 1080 });
  });

  afterEach(() => {
    setVisibility('visible');
  });

  it('beacons the start to the playback endpoint under a session the video load owns', () => {
    const { result } = renderHook(() => usePlaybackTelemetry(VIDEO_ID));

    result.current.onPlay(PROGRESS);

    expect(sent()).toEqual([
      {
        url: 'http://localhost:3000/v1/telemetry/playback',
        event: expect.objectContaining({
          videoId: VIDEO_ID,
          eventType: 'playback_start',
          sessionUuid: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      },
    ]);
  });

  it.each([
    ['a phone', true, { width: 390, height: 844 }, 'mobile'],
    ['a tablet', true, { width: 820, height: 1180 }, 'tablet'],
    ['a desktop', false, { width: 1920, height: 1080 }, 'desktop'],
  ])('tells the endpoint it is %s', (_name, coarse, screen, device) => {
    reportPointer(coarse, screen);

    renderHook(() => usePlaybackTelemetry(VIDEO_ID)).result.current.onPlay(PROGRESS);

    expect(sent()[0]?.event).toMatchObject({ device });
  });

  it('starts a new session for the next video load', () => {
    renderHook(() => usePlaybackTelemetry(VIDEO_ID)).result.current.onPlay(PROGRESS);
    renderHook(() => usePlaybackTelemetry(VIDEO_ID)).result.current.onPlay(PROGRESS);

    const [first, second] = sent().map(({ event }) => event);
    expect(first).toHaveProperty('sessionUuid');
    expect(first).not.toEqual(second);
  });

  it('flushes the watched segment when the page is hidden and when the player unmounts', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePlaybackTelemetry(VIDEO_ID));
    result.current.onPlay(PROGRESS);
    vi.mocked(sendJsonBeacon).mockClear();

    vi.advanceTimersByTime(5000);
    setVisibility('hidden');
    expect(sent()).toHaveLength(1);

    setVisibility('visible');
    vi.advanceTimersByTime(7000);
    unmount();
    expect(sent()).toHaveLength(2);
    vi.useRealTimers();
  });
});
