import { render, screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { variantNames } from '#app/__tests__/variant-names';
import { Spinner, spinnerVariants } from '../spinner';

const SIZES = variantNames(spinnerVariants.variants.size);

describe('apps/web: Spinner', () => {
  it.each(SIZES)('announces what is loading at size %s', (size) => {
    render(<Spinner label="Loading comments" size={size} />);

    expect(screen.getByRole('status', { name: 'Loading comments' })).toBeInTheDocument();
  });

  it('stops spinning for a viewer who asked for reduced motion', () => {
    render(<Spinner label="Loading" />);

    expect(screen.getByRole('status')).toHaveClass(
      'tw:animate-spin',
      'tw:motion-reduce:animate-none'
    );
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<Spinner label="Loading comments" />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
