import { render } from '@testing-library/react';
import { VideoCardSkeleton } from '../video-card-skeleton';

describe('apps/client/web: VideoCardSkeleton', () => {
  it.each([
    { props: {}, count: 1 },
    { props: { count: 3 }, count: 3 },
    { props: { variant: 'row' as const, count: 2 }, count: 2 },
  ])('renders $count placeholders for $props', ({ props, count }) => {
    const { container } = render(<VideoCardSkeleton {...props} />);

    expect(container.querySelectorAll('[data-slot="video-card-skeleton"]')).toHaveLength(count);
  });
});
