import { renderHook } from '@testing-library/react';
import { videoSummary } from '@vp/web-testing';
import { useMediaSession } from '../use-media-session';

const handlers = new Map<string, (() => void) | null>();
const session = {
  metadata: null as MediaMetadata | null,
  setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
    handlers.set(action, handler);
  }),
};

class FakeMetadata {
  constructor(readonly init: MediaMetadataInit) {}
}

const VIDEO = videoSummary({ title: 'Launch day', posterUrl: 'http://localhost:9000/p.jpg' });

describe('apps/client/web: useMediaSession', () => {
  beforeEach(() => {
    handlers.clear();
    session.metadata = null;
    vi.stubGlobal('MediaMetadata', FakeMetadata);
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaSession');
  });

  it('tells the system what plays and wires the media keys to the queue', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onNext = vi.fn();
    renderHook(() =>
      useMediaSession({ video: VIDEO, onPlay, onPause, onPrevious: undefined, onNext })
    );

    expect((session.metadata as unknown as FakeMetadata).init).toMatchObject({
      title: 'Launch day',
      artwork: [{ src: 'http://localhost:9000/p.jpg' }],
    });
    handlers.get('play')?.();
    handlers.get('pause')?.();
    handlers.get('nexttrack')?.();
    expect([onPlay, onPause, onNext].map((handler) => handler.mock.calls.length)).toEqual([
      1, 1, 1,
    ]);
    expect(handlers.get('previoustrack')).toBeNull();
  });

  it('lets go of the session when nothing plays or the host goes', () => {
    const { unmount } = renderHook(() =>
      useMediaSession({
        video: VIDEO,
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onPrevious: undefined,
        onNext: undefined,
      })
    );

    unmount();

    expect(session.metadata).toBeNull();
    expect([...handlers.values()].every((handler) => handler === null)).toBe(true);
  });

  it('does nothing in a browser with no media session, or with nothing playing', () => {
    Reflect.deleteProperty(navigator, 'mediaSession');

    expect(() =>
      renderHook(() =>
        useMediaSession({
          video: VIDEO,
          onPlay: vi.fn(),
          onPause: vi.fn(),
          onPrevious: undefined,
          onNext: undefined,
        })
      )
    ).not.toThrow();
    expect(session.setActionHandler).not.toHaveBeenCalled();
  });
});
