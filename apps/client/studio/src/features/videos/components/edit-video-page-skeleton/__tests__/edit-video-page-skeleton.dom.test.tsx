import { render } from '@testing-library/react';
import { EditVideoPageSkeleton } from '../edit-video-page-skeleton';

describe('apps/client/studio: EditVideoPageSkeleton', () => {
  it('stands in for the editor, hidden from assistive technology, and cannot widen the page', () => {
    const { container } = render(<EditVideoPageSkeleton />);
    const skeleton = container.querySelector('[data-slot="edit-video-page-skeleton"]');

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton).toHaveClass('min-w-0');
    expect(skeleton?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(10);
  });
});
