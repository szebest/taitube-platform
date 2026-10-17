import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Separator, separatorVariants } from '../separator';
import { variantNames } from '../variant-names';

const ORIENTATIONS = variantNames(separatorVariants.variants.orientation);

function renderSeparator(props: ComponentProps<typeof Separator> = {}) {
  return render(<Separator {...props} />);
}

describe('@vp/ui: Separator', () => {
  it.each(ORIENTATIONS)('is a %s separator when it divides content', (orientation) => {
    renderSeparator({ orientation, decorative: false });

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', orientation);
  });

  it('is skipped by assistive technology when it is only decoration', () => {
    renderSeparator();

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderSeparator({ decorative: false });

    expect(await axeViolations()).toEqual([]);
  });
});
