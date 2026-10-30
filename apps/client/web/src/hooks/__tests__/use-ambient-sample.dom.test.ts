import { act, renderHook } from '@testing-library/react';

import { useAmbientSample } from '../use-ambient-sample';

const DUSK = [200, 100, 50, 255, 40, 30, 60, 255, 0, 0, 0, 255];
const DAWN = [0, 0, 0, 255, 40, 30, 60, 255, 200, 100, 50, 255];

function canvasReading(...frames: number[][]) {
  const drawImage = vi.fn();
  const getImageData = vi.fn(() => ({ data: Uint8ClampedArray.from(frames.shift() ?? DUSK) }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    getImageData,
  } as unknown as CanvasRenderingContext2D);
  return { drawImage, getImageData };
}

function frameClock() {
  let now = 0;
  const pending: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.push(callback);
    return pending.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  return (ms: number) =>
    act(() => {
      now += ms;
      pending.shift()?.(now);
    });
}

function playingVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: HTMLMediaElement.HAVE_ENOUGH_DATA });
  return video;
}

describe('apps/client/web: useAmbientSample', () => {
  afterEach(() => {
    delete document.documentElement.dataset.motion;
    vi.unstubAllGlobals();
  });

  it('has no colour before there is a source', () => {
    const { result } = renderHook(() => useAmbientSample(undefined));

    expect(result.current).toEqual([]);
  });

  it('samples a poster once it loads, one colour per third', () => {
    canvasReading(DUSK);
    const posters: { src: string; onload: (() => void) | null }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        crossOrigin = '';
        src = '';
        onload: (() => void) | null = null;
        constructor() {
          posters.push(this);
        }
      }
    );
    const { result } = renderHook(() => useAmbientSample('/poster.jpg'));

    expect(result.current).toEqual([]);
    act(() => posters[0]?.onload?.());

    expect(posters[0]?.src).toBe('/poster.jpg');
    expect(result.current).toEqual(['rgb(200 100 50)', 'rgb(40 30 60)', 'rgb(0 0 0)']);
  });

  it('follows a playing video, smoothing toward each new frame', () => {
    canvasReading(DUSK, DAWN);
    const tick = frameClock();
    const { result } = renderHook(({ video }) => useAmbientSample(video), {
      initialProps: { video: playingVideo() },
    });

    tick(100);
    expect(result.current).toEqual(['rgb(200 100 50)', 'rgb(40 30 60)', 'rgb(0 0 0)']);

    tick(100);
    expect(result.current).toEqual(['rgb(150 75 38)', 'rgb(40 30 60)', 'rgb(50 25 13)']);
  });

  it('keeps the first frame under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { getImageData } = canvasReading(DUSK, DAWN);
    const tick = frameClock();
    renderHook(({ video }) => useAmbientSample(video), {
      initialProps: { video: playingVideo() },
    });

    tick(100);
    tick(100);

    expect(getImageData).toHaveBeenCalledOnce();
  });

  it('samples no faster than 12 frames a second', () => {
    const { getImageData } = canvasReading(DUSK, DAWN, DUSK);
    const tick = frameClock();
    renderHook(({ video }) => useAmbientSample(video), {
      initialProps: { video: playingVideo() },
    });

    tick(100);
    tick(16);
    tick(16);

    expect(getImageData).toHaveBeenCalledOnce();
  });
});
