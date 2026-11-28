import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { PlaylistCover, type PlaylistCoverProps } from '..';

const URLS = ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg'];

const renderCover = (props: Partial<PlaylistCoverProps> = {}) =>
  render(<PlaylistCover images={[]} {...props} />);

const cover = (container: HTMLElement) => container.querySelector('[data-slot=playlist-cover]');

describe('apps/client/web: PlaylistCover', () => {
  it.each([
    { images: 0, drawn: 0 },
    { images: 1, drawn: 1 },
    { images: 2, drawn: 2 },
    { images: 3, drawn: 3 },
    { images: 4, drawn: 4 },
    { images: 5, drawn: 4 },
  ])('draws $drawn pictures for $images images', ({ images, drawn }) => {
    const { container } = renderCover({ images: URLS.slice(0, images) });

    expect(container.querySelectorAll('img')).toHaveLength(drawn);
    expect(cover(container)).toHaveAttribute('data-count', String(drawn));
  });

  it('shows the playlist icon in an empty frame', () => {
    const { container } = renderCover();

    expect(container.querySelector('[data-icon=playlist]')).toBeInTheDocument();
  });

  it('spans the first of three pictures over both rows', () => {
    const { container } = renderCover({ images: URLS.slice(0, 3) });

    expect(container.querySelector('img')).toHaveClass('row-span-2');
  });

  it('is decoration: hidden from assistive technology, its images without text', () => {
    const { container } = renderCover({ images: URLS.slice(0, 2) });

    expect(cover(container)).toHaveAttribute('aria-hidden', 'true');
    for (const image of container.querySelectorAll('img')) {
      expect(image).toHaveAttribute('alt', '');
    }
  });

  it('passes axe', async () => {
    renderCover({ images: URLS.slice(0, 4) });

    expect(await axeViolations()).toEqual([]);
  });
});
