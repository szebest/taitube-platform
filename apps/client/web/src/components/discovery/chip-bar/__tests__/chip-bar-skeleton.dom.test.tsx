import { render } from '@testing-library/react';
import { ChipBarSkeleton } from '../chip-bar-skeleton';

describe('apps/client/web: ChipBarSkeleton', () => {
  it('is hidden from assistive technology and holds seven pills', () => {
    const { container } = render(<ChipBarSkeleton />);
    const root = container.querySelector('[data-slot="chip-bar-skeleton"]');

    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root?.children).toHaveLength(7);
  });
});
