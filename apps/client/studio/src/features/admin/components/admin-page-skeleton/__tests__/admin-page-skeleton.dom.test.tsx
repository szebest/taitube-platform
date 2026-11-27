import { render } from '@testing-library/react';
import { AdminPageSkeleton } from '../admin-page-skeleton';

describe('apps/client/studio: AdminPageSkeleton', () => {
  it('stands in for a table of rows, without a selection column', () => {
    const { container } = render(<AdminPageSkeleton />);

    expect(container.querySelector('[data-slot="data-table-skeleton"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(
      container.querySelectorAll('[data-slot="data-table-skeleton-row"]').length
    ).toBeGreaterThan(0);
  });
});
