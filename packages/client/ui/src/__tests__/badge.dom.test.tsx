import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Badge, badgeVariants } from '../badge';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(badgeVariants.variants.variant);

function renderBadge(props: Partial<ComponentProps<typeof Badge>> = {}) {
  return render(<Badge {...props}>READY</Badge>);
}

function renderEveryBadge() {
  return render(
    <p>
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </p>
  );
}

describe('@vp/ui: Badge', () => {
  it.each(VARIANTS)('reads its %s label as plain text', (variant) => {
    renderBadge({ variant });

    expect(screen.getByText('READY')).toHaveAttribute('data-slot', 'badge');
  });

  it('passes axe', async () => {
    renderEveryBadge();

    expect(await axeViolations()).toEqual([]);
  });
});
