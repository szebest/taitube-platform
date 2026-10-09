import { render, screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { Badge, badgeVariants } from '../badge';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(badgeVariants.variants.variant);

describe('apps/web: Badge', () => {
  it.each(VARIANTS)('reads its %s label as plain text', (variant) => {
    render(<Badge variant={variant}>READY</Badge>);

    expect(screen.getByText('READY')).toHaveAttribute('data-slot', 'badge');
  });

  it('passes axe', async () => {
    render(
      <p>
        {VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </p>
    );

    expect(await axeViolations()).toEqual([]);
  });
});
