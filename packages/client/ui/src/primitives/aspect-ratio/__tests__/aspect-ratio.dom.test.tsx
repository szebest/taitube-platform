import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { AspectRatio, type AspectRatioProps } from '../aspect-ratio';

function renderPoster(props: AspectRatioProps = {}) {
  render(
    <AspectRatio {...props}>
      <img src="/poster.jpg" alt="Lisbon at night" />
    </AspectRatio>
  );
  return screen.getByRole('img', { name: 'Lisbon at night' }).parentElement;
}

describe('@vp/ui: AspectRatio', () => {
  it.each([
    { shape: 'video', ratio: undefined, padding: `${100 / (16 / 9)}%` },
    { shape: 'poster', ratio: undefined, padding: `${100 / (9 / 16)}%` },
    { shape: 'square', ratio: undefined, padding: '100%' },
    { shape: 'banner', ratio: undefined, padding: `${100 / (21 / 9)}%` },
    { shape: 'video', ratio: 4 / 3, padding: '75%' },
  ] as const)(
    'reserves the $shape ratio, or the $ratio it is given',
    ({ shape, ratio, padding }) => {
      expect(renderPoster({ shape, ratio })?.parentElement).toHaveStyle({ paddingBottom: padding });
    }
  );

  it('passes axe', async () => {
    renderPoster();

    expect(await axeViolations()).toEqual([]);
  });
});
