import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { BrandAccentPreview } from '../brand-accent-preview';

describe('apps/client/studio: BrandAccentPreview', () => {
  it.each(['#3366cc', '#ffff00', '#fefefe', '#010101'])(
    'derives the accent of %s on a dark and on a light page',
    (hex) => {
      const { container } = render(<BrandAccentPreview hex={hex} />, { wrapper: AppProviders });

      expect(screen.getByText('On dark')).toBeInTheDocument();
      expect(screen.getByText('On light')).toBeInTheDocument();
      expect(container.querySelectorAll('[data-family]')).toHaveLength(2);
    }
  );

  it('shows nothing for a colour the engine cannot read', () => {
    const { container } = render(<BrandAccentPreview hex="#33" />, { wrapper: AppProviders });

    expect(container.querySelectorAll('[data-family]')).toHaveLength(0);
  });
});
