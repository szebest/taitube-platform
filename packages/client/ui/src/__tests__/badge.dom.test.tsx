import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Badge, badgeVariants } from '../badge';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(badgeVariants.variants.variant);

function renderBadge(props: ComponentProps<typeof Badge> = {}) {
  return render(<Badge {...{ children: 'READY', ...props }} />);
}

describe('@vp/ui: Badge', () => {
  it.each(VARIANTS)('reads its %s label as plain text', (variant) => {
    renderBadge({ variant });

    expect(screen.getByText('READY')).toHaveAttribute('data-slot', 'badge');
  });

  it('passes axe', async () => {
    for (const variant of VARIANTS) renderBadge({ variant, children: variant });

    expect(await axeViolations()).toEqual([]);
  });
});
