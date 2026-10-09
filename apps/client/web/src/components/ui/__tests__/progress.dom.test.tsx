import { render, screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { Field } from '../field';
import { Progress, progressVariants } from '../progress';
import { variantNames } from '../variant-names';

const SIZES = variantNames(progressVariants.variants.size);

describe('apps/web: Progress', () => {
  it.each(SIZES)('reports how far a %s bar has got, named by its field', (size) => {
    render(
      <Field label="Uploading launch.mp4">
        <Progress value={40} max={100} size={size} />
      </Field>
    );

    const bar = screen.getByRole('progressbar', { name: 'Uploading launch.mp4' });
    expect(bar).toHaveAttribute('value', '40');
    expect(bar).toHaveAttribute('max', '100');
  });

  it('is indeterminate without a value', () => {
    render(<Progress aria-label="Processing" />);

    expect(screen.getByRole('progressbar', { name: 'Processing' })).not.toHaveAttribute('value');
  });

  it('passes axe', async () => {
    render(<Progress aria-label="Uploading" value={40} max={100} />);

    expect(await axeViolations()).toEqual([]);
  });
});
