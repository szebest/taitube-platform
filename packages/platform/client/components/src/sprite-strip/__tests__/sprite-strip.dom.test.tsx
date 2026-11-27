import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { SpriteStrip, type SpriteStripProps } from '../sprite-strip';

const SPRITE = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

const renderStrip = (props: Partial<SpriteStripProps> = {}) =>
  render(<SpriteStrip sprite={SPRITE} durationMs={120_000} {...props} />);

const framesOf = (container: HTMLElement) =>
  container.querySelectorAll('div[style*="background-image"]');

describe('@kit/components: SpriteStrip', () => {
  it.each([
    { name: 'eight by default', props: {}, frames: 8 },
    { name: 'as many as asked for', props: { frames: 4 }, frames: 4 },
  ])('lays $name frames side by side', ({ props, frames }) => {
    const { container } = renderStrip(props);

    expect(framesOf(container)).toHaveLength(frames);
  });

  it('shows the frame at the middle of each slice of the video', () => {
    const { container } = renderStrip({
      sprite: { ...SPRITE, columns: 5 },
      durationMs: 100_000,
      frames: 2,
    });

    expect(
      [...framesOf(container)].map((frame) => (frame as HTMLElement).style.backgroundPosition)
    ).toEqual(['50% 0%', '50% 100%']);
  });

  it.each([
    { name: 'without a shade', shade: undefined, widths: [] },
    {
      name: 'around the span 30 to 90 seconds',
      shade: { startMs: 30_000, endMs: 90_000 },
      widths: ['25%', '25%'],
    },
  ])('dims what lies outside the span $name', ({ shade, widths }) => {
    const { container } = renderStrip({ shade });

    const dimmed = [...container.querySelectorAll<HTMLElement>('.bg-scrim')].map(
      (element) => element.style.inlineSize
    );

    expect(dimmed).toEqual(widths);
  });

  it('is decoration and has no accessibility violations', async () => {
    const { container } = renderStrip();

    expect(container.querySelector('[data-slot="sprite-strip"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(await axeViolations()).toEqual([]);
  });
});
