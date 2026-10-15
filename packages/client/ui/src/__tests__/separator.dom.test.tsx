import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing';

import { Separator, separatorVariants } from '../separator';
import { variantNames } from '../variant-names';

const ORIENTATIONS = variantNames(separatorVariants.variants.orientation);

describe('@vp/ui: Separator', () => {
  it.each(ORIENTATIONS)('is a %s separator when it divides content', (orientation) => {
    render(<Separator orientation={orientation} decorative={false} />);

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', orientation);
  });

  it('is skipped by assistive technology when it is only decoration', () => {
    render(<Separator />);

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    render(<Separator decorative={false} />);

    expect(await axeViolations()).toEqual([]);
  });
});
