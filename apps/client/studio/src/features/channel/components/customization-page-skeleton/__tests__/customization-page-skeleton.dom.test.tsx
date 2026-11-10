import { render } from '@testing-library/react';
import { CustomizationPageSkeleton } from '../customization-page-skeleton';

describe('apps/client/studio: CustomizationPageSkeleton', () => {
  it('stands in for the heading and the five sections, hidden from assistive technology', () => {
    const { container } = render(<CustomizationPageSkeleton />);
    const skeleton = container.querySelector('[data-slot="customization-page-skeleton"]');

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
  });
});
