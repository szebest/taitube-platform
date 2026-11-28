import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PlayerChannelProvider, useOnPlayerEnded } from '#app/lib/player/player-channel';
import { useRangePlayback } from '../use-range-playback';

const range = { startMs: 10_000, endMs: 20_000 };

function renderRange(props: Parameters<typeof useRangePlayback>[0] = { range }) {
  const onChannelEnded = vi.fn();
  const video = document.createElement('video');
  vi.spyOn(video, 'pause').mockImplementation(() => {});
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlayerChannelProvider>{children}</PlayerChannelProvider>
  );
  const { result } = renderHook(
    () => {
      useOnPlayerEnded(onChannelEnded);
      return useRangePlayback(props);
    },
    { wrapper }
  );
  return { playback: result.current, video, onChannelEnded };
}

describe('apps/client/web: useRangePlayback', () => {
  it.each([
    { scenario: 'the range', props: { range, startTime: 42 }, at: 10 },
    { scenario: 'the start time without a range', props: { startTime: 42 }, at: 42 },
  ])('starts at $scenario', ({ props, at }) => {
    const { playback, video } = renderRange(props);

    playback.onLoadedMetadata(video);

    expect(video.currentTime).toBe(at);
  });

  it.each([
    { at: 5, where: 'before its start', loop: undefined, stays: false },
    { at: 9.8, where: 'a hair before its start', loop: undefined, stays: true },
    { at: 15, where: 'inside it', loop: undefined, stays: true },
    { at: 20, where: 'at its end, looping', loop: true, stays: false },
    { at: 25, where: 'past its end, looping', loop: true, stays: false },
    { at: 20, where: 'at its end, not looping', loop: undefined, stays: true },
  ])('moves the playhead from $where: stays $stays', ({ at, loop, stays }) => {
    const { playback, video } = renderRange({ range, loop });
    video.currentTime = at;

    playback.onTimeUpdate(video);

    expect(video.currentTime).toBe(stays ? at : 10);
  });

  it.each([
    { scenario: 'the playhead reaches the end', end: 'onTimeUpdate' as const },
    { scenario: 'the video ends inside it', end: 'onVideoEnded' as const },
  ])('stops once and tells the caller and the channel when $scenario', ({ end }) => {
    const onEnded = vi.fn();
    const { playback, video, onChannelEnded } = renderRange({ range, onEnded });
    video.currentTime = 20;

    playback[end](video);
    playback[end](video);

    expect([
      vi.mocked(video.pause).mock.calls.length,
      onEnded.mock.calls.length,
      onChannelEnded.mock.calls.length,
    ]).toEqual([1, 1, 1]);
  });

  it.each([
    { scenario: 'a range that loops', props: { range, loop: true }, handled: true, restarts: 10 },
    { scenario: 'a range that stops', props: { range }, handled: true, restarts: 20 },
    { scenario: 'no range', props: {}, handled: false, restarts: 20 },
  ])('answers the end of the video with $scenario', ({ props, handled, restarts }) => {
    const { playback, video } = renderRange(props);
    video.currentTime = 20;

    expect(playback.onVideoEnded(video)).toBe(handled);
    expect(video.currentTime).toBe(restarts);
  });

  it('starts over when the viewer plays a stopped range again', () => {
    const { playback, video } = renderRange();
    video.currentTime = 20;
    playback.onTimeUpdate(video);

    playback.onPlaying(video);

    expect(video.currentTime).toBe(10);
  });
});
