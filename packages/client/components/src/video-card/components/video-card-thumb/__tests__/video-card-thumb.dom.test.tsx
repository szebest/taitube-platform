import { screen } from '@testing-library/react';
import { renderWithCopy } from '../../../../__tests__/render-with-copy';
import { VideoCardContext } from '../../../video-card.context';
import { VideoCardThumb } from '../video-card-thumb';

const FRAMES = {
  url: '/sprite.jpg',
  columns: 4,
  count: 8,
  tileWidth: 160,
  tileHeight: 90,
  intervalSec: 5,
};

const renderThumb = (
  shared: {
    state?: 'rest' | 'live' | 'unavailable';
    expanded?: boolean;
    previewing?: boolean;
  } = {},
  previewSrc?: string,
  frames?: typeof FRAMES
) =>
  renderWithCopy(
    <VideoCardContext
      value={{
        variant: 'grid',
        state: 'rest',
        size: 'md',
        videoId: undefined,
        expanded: false,
        previewing: false,
        ...shared,
      }}
    >
      <VideoCardThumb
        src="/poster.jpg"
        alt="Poster"
        duration="1:00"
        previewSrc={previewSrc}
        frames={frames}
      />
    </VideoCardContext>
  );

describe('@vp/components: VideoCardThumb', () => {
  it('prints the duration', () => {
    renderThumb();

    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it.each([
    { name: 'expanded with a preview', expanded: true, preview: '/clip.mp4', expected: 1 },
    { name: 'expanded without a preview', expanded: true, preview: undefined, expected: 0 },
    { name: 'not expanded', expanded: false, preview: '/clip.mp4', expected: 0 },
  ])('renders $expected preview clips when $name', ({ expanded, preview, expected }) => {
    const { container } = renderThumb({ expanded }, preview);

    expect(container.querySelectorAll('[data-slot="video-card-preview"]')).toHaveLength(expected);
  });

  it.each([
    { name: 'previewing with frames', previewing: true, frames: FRAMES, expected: 1 },
    { name: 'previewing with none', previewing: true, frames: undefined, expected: 0 },
    { name: 'not previewing', previewing: false, frames: FRAMES, expected: 0 },
  ])('renders $expected frame players when $name', ({ previewing, frames, expected }) => {
    const { container } = renderThumb({ previewing }, undefined, frames);

    expect(container.querySelectorAll('[data-slot="video-card-frames"]')).toHaveLength(expected);
  });
});
