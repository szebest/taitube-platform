import { render, screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { variantNames } from '#app/__tests__/variant-names';
import { Separator, separatorVariants } from '../separator';

const ORIENTATIONS = variantNames(separatorVariants.variants.orientation);

describe('apps/web: Separator', () => {
  it.each(ORIENTATIONS)('is a %s separator when it divides content', (orientation) => {
    render(<Separator orientation={orientation} decorative={false} />);

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', orientation);
  });

  it('is skipped by assistive technology when it is only decoration', () => {
    render(<Separator />);

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<Separator decorative={false} />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
