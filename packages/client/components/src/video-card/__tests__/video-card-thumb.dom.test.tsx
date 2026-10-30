import { screen } from '@testing-library/react';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { VideoCardContext } from '../video-card.context';
import { VideoCardThumb } from '../video-card-thumb';

const renderThumb = (
  shared: { state?: 'rest' | 'live' | 'unavailable'; expanded?: boolean } = {},
  previewSrc?: string
) =>
  renderWithCopy(
    <VideoCardContext
      value={{
        variant: 'grid',
        state: 'rest',
        size: 'md',
        videoId: undefined,
        expanded: false,
        ...shared,
      }}
    >
      <VideoCardThumb src="/poster.jpg" alt="Poster" duration="1:00" previewSrc={previewSrc} />
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
});
