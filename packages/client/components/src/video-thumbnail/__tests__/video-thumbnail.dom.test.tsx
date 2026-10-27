import { fireEvent, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ReactNode } from 'react';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { VideoThumbnail, VideoThumbnailSkeleton, videoTransitionName } from '..';
import type { VideoThumbnailRootProps } from '../video-thumbnail';

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000001';

const renderThumbnail = (children: ReactNode, props: VideoThumbnailRootProps = {}) =>
  renderWithCopy(
    <VideoThumbnail.Root data-testid="frame" videoId={VIDEO_ID} {...props}>
      {children}
    </VideoThumbnail.Root>
  );

describe('@vp/components: VideoThumbnail', () => {
  it('names the frame for the view transition into the stage', () => {
    renderThumbnail(<VideoThumbnail.Image src="/poster.jpg" />);

    expect(screen.getByTestId('frame')).toHaveStyle({
      viewTransitionName: videoTransitionName(VIDEO_ID),
    });
  });

  it('fades the image in once it has loaded, decorative unless given a name', () => {
    renderThumbnail(<VideoThumbnail.Image src="/poster.jpg" />);
    const image = screen.getByRole('presentation');

    expect(image).not.toHaveAttribute('data-loaded');
    fireEvent.load(image);
    expect(image).toHaveAttribute('data-loaded');
  });

  it('shows a placeholder with no image for a video still processing', () => {
    renderThumbnail(<VideoThumbnail.Image />);

    expect(screen.queryByRole('presentation')).toBeNull();
    expect(screen.getByTestId('frame').querySelector('[data-icon="video"]')).not.toBeNull();
  });

  it('says the duration in words and hides the clock text from a screen reader', () => {
    renderThumbnail(
      <VideoThumbnail.Duration spoken="18 minutes 42 seconds">18:42</VideoThumbnail.Duration>
    );

    expect(screen.getByText('18:42')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('18 minutes 42 seconds')).toBeInTheDocument();
  });

  it.each([
    { value: 0.62, shown: '62' },
    { value: 1.4, shown: '100' },
  ])('reports $value watched as a progress bar at $shown', ({ value, shown }) => {
    renderThumbnail(<VideoThumbnail.Progress value={value} />);

    expect(screen.getByRole('progressbar', { name: 'watched' })).toHaveAttribute(
      'aria-valuenow',
      shown
    );
  });

  it('draws no progress for a video not started', () => {
    renderThumbnail(<VideoThumbnail.Progress value={0} />);

    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('says a live video is live in words', () => {
    renderThumbnail(<VideoThumbnail.Live />);

    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('throws a named error for a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderWithCopy(<VideoThumbnail.Live />)).toThrow(
      'VideoThumbnail.Live must be inside VideoThumbnail.Root'
    );
  });

  it('passes axe, loaded, live, as a poster and as a skeleton', async () => {
    renderThumbnail(
      <>
        <VideoThumbnail.Image src="/poster.jpg" />
        <VideoThumbnail.Duration spoken="18 minutes 42 seconds">18:42</VideoThumbnail.Duration>
        <VideoThumbnail.Progress value={0.5} />
      </>
    );
    renderThumbnail(<VideoThumbnail.Live />, { aspect: 'poster' });
    renderWithCopy(<VideoThumbnailSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
