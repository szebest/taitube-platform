import { act, render } from '@testing-library/react';
import { VideoCardFrames, type VideoCardSprite } from '../video-card-frames';

const SPRITE: VideoCardSprite = {
  url: '/sprite.jpg',
  columns: 3,
  count: 7,
  tileWidth: 160,
  tileHeight: 90,
  intervalSec: 5,
};

const sheet = (container: HTMLElement) => container.querySelector('img') as HTMLImageElement;

describe('@vp/components: VideoCardFrames', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lays the whole sheet under a hidden frame, as wide as its columns', () => {
    const { container } = render(<VideoCardFrames sprite={SPRITE} className="frame" />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveAttribute('dir', 'ltr');
    expect(sheet(container)).toHaveAttribute('src', '/sprite.jpg');
    expect(sheet(container).style.width).toBe('300%');
  });

  it('steps one tile every quarter of a second, wrapping at the last, with a translate alone', () => {
    const { container } = render(<VideoCardFrames sprite={SPRITE} />);
    const seen = [sheet(container).style.translate];

    for (let frame = 1; frame <= 7; frame += 1) {
      act(() => {
        vi.advanceTimersByTime(250);
      });
      seen.push(sheet(container).style.translate);
    }

    expect(seen).toEqual([
      '0% 0%',
      '-33.333% 0%',
      '-66.667% 0%',
      '0% -33.333%',
      '-33.333% -33.333%',
      '-66.667% -33.333%',
      '0% -66.667%',
      '0% 0%',
    ]);
  });

  it('stops stepping when it unmounts', () => {
    const clear = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<VideoCardFrames sprite={SPRITE} />);

    unmount();

    expect(clear).toHaveBeenCalled();
  });
});
