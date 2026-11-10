import { screen, within } from '@testing-library/react';
import { SHORTS } from '#app/__tests__/short-fixtures';
import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const slides = () => [...document.querySelectorAll<HTMLElement>('[data-slot="shorts-slide"]')];
const activeSlide = () => screen.getByRole('group', { name: 'Short 2' });

describe('apps/client/web: ShortsSlide', () => {
  beforeEach(async () => {
    await renderShorts({ path: `/shorts/${SHORTS[1]?.id}` });
  });

  it('gives the Short on screen its controls, its seek bar and its actions', () => {
    const slide = activeSlide();

    expect(within(slide).getByRole('toolbar', { name: 'Short controls' })).toBeInTheDocument();
    expect(within(slide).getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    for (const action of ['Like 24', 'Discussion', 'Share']) {
      expect(within(slide).getByRole('button', { name: action })).toBeInTheDocument();
    }
  });

  it('names the channel, offers Subscribe and shows the title over the picture', () => {
    const slide = activeSlide();

    expect(within(slide).getByText('The Creator')).toBeInTheDocument();
    expect(within(slide).getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(within(slide).getByText('Short 2', { selector: 'p' })).toBeInTheDocument();
  });

  it('holds the Short before and the one after paused and out of reach, without controls', () => {
    const [before, , after, far] = slides();

    for (const beside of [before, after]) {
      expect(beside).toHaveAttribute('aria-hidden', 'true');
      expect(beside).toHaveAttribute('inert');
      expect(within(beside as HTMLElement).queryByRole('toolbar')).not.toBeInTheDocument();
      expect(beside?.querySelector('[data-testid="player"]')).toHaveAttribute(
        'data-paused',
        'true'
      );
    }
    expect(far?.querySelector('[data-testid="player"]')).toBeNull();
    expect(far).toBeEmptyDOMElement();
  });

  it('keeps the playhead out of the slide, so the caption and the actions do not render with it', () => {
    expect(activeSlide().querySelector('[data-testid="player"]')).toHaveAttribute(
      'data-time-update',
      'false'
    );
  });

  it('offers captions only when the Short has a ready track', () => {
    expect(within(activeSlide()).getByRole('button', { name: 'Captions' })).toBeDisabled();
  });
});
