import { act, render, renderHook, screen } from '@testing-library/react';
import { type PropsWithChildren, useEffect } from 'react';
import {
  PlayerChannelProvider,
  useOfferedPlayerChannel,
  useOnPlayerEnded,
  usePlayerFullscreen,
  usePlayerSeek,
  usePlayerTheater,
  usePlayerTime,
} from '../player-channel';

function Engine({ seek, children }: PropsWithChildren<{ seek: (seconds: number) => void }>) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.attach(seek), [channel, seek]);

  return <>{children}</>;
}

function Publisher({ seconds }: { seconds: number }) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.publish(seconds), [channel, seconds]);

  return null;
}

describe('apps/client/web: player channel', () => {
  it('hands a seek to the engine that attached,', () => {
    const seek = vi.fn();
    const { result } = renderHook(() => usePlayerSeek(), {
      wrapper: ({ children }) => (
        <PlayerChannelProvider>
          <Engine seek={seek}>{children}</Engine>
        </PlayerChannelProvider>
      ),
    });

    result.current.seek(42);
    expect(seek).toHaveBeenCalledWith(42);
  });

  it('seeks nothing before an engine attaches', () => {
    const { result } = renderHook(() => usePlayerSeek(), { wrapper: PlayerChannelProvider });

    expect(() => result.current.seek(42)).not.toThrow();
  });

  it('re-renders a reader of the playhead only when what it derives changes', () => {
    const renders = vi.fn();
    function Reader() {
      const minutes = usePlayerTime((seconds) => Math.floor(seconds / 60));
      renders(minutes);
      return <p>{minutes}</p>;
    }
    const { rerender } = render(
      <PlayerChannelProvider>
        <Publisher seconds={10} />
        <Reader />
      </PlayerChannelProvider>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    renders.mockClear();

    for (const seconds of [20, 30, 70]) {
      act(() =>
        rerender(
          <PlayerChannelProvider>
            <Publisher seconds={seconds} />
            <Reader />
          </PlayerChannelProvider>
        )
      );
    }

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(renders.mock.calls.filter(([minutes]) => minutes === 1)).toHaveLength(1);
  });

  it('flips theater mode for every reader, and reads it off outside a provider', () => {
    const { result } = renderHook(
      () => ({ channel: usePlayerSeek(), theater: usePlayerTheater() }),
      {
        wrapper: PlayerChannelProvider,
      }
    );
    expect(result.current.theater).toBe(false);

    act(() => result.current.channel.toggleTheater());
    expect(result.current.theater).toBe(true);

    act(() => result.current.channel.toggleTheater());
    expect(result.current.theater).toBe(false);
    expect(renderHook(() => usePlayerTheater()).result.current).toBe(false);
  });

  it('tells every reader whether the engine is fullscreen, and reads it off outside a provider', () => {
    const { result } = renderHook(
      () => ({ channel: useOfferedPlayerChannel(), fullscreen: usePlayerFullscreen() }),
      { wrapper: PlayerChannelProvider }
    );

    act(() => result.current.channel?.publishFullscreen(true));

    expect(result.current.fullscreen).toBe(true);
    expect(renderHook(() => usePlayerFullscreen()).result.current).toBe(false);
  });

  it('tells the listener the video ended, with its latest closure, until it unmounts', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ listener }) => {
        useOnPlayerEnded(listener);
        return useOfferedPlayerChannel();
      },
      { initialProps: { listener: first }, wrapper: PlayerChannelProvider }
    );

    rerender({ listener: second });
    act(() => result.current?.end());
    unmount();
    act(() => result.current?.end());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('listens to nothing outside a provider', () => {
    expect(() => renderHook(() => useOnPlayerEnded(vi.fn()))).not.toThrow();
  });

  it('refuses a reader outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => usePlayerSeek())).toThrow(
      'usePlayerSeek must be used within PlayerChannelProvider'
    );
  });
});
