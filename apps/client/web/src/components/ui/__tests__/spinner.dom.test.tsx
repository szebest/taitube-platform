import { render, screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { Spinner, spinnerVariants } from '../spinner';
import { variantNames } from '../variant-names';

const SIZES = variantNames(spinnerVariants.variants.size);

describe('apps/client/web: Spinner', () => {
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

  it('passes axe', async () => {
    render(<Spinner label="Loading comments" />);

    expect(await axeViolations()).toEqual([]);
  });
});
