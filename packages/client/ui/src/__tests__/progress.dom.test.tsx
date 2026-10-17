import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Field } from '../field';
import { Progress, progressVariants } from '../progress';
import { variantNames } from '../variant-names';

const SIZES = variantNames(progressVariants.variants.size);

function renderProgress({
  label,
  ...props
}: ComponentProps<typeof Progress> & { label?: string } = {}) {
  const progress = <Progress {...props} />;
  return render(label ? <Field label={label}>{progress}</Field> : progress);
}

describe('@vp/ui: Progress', () => {
  it.each(SIZES)('reports how far a %s bar has got, named by its field', (size) => {
    renderProgress({ label: 'Uploading launch.mp4', value: 40, max: 100, size });

    const bar = screen.getByRole('progressbar', { name: 'Uploading launch.mp4' });
    expect(bar).toHaveAttribute('value', '40');
    expect(bar).toHaveAttribute('max', '100');
  });

  it('is indeterminate without a value', () => {
    renderProgress({ 'aria-label': 'Processing' });

    expect(screen.getByRole('progressbar', { name: 'Processing' })).not.toHaveAttribute('value');
  });

  it('passes axe', async () => {
    renderProgress({ 'aria-label': 'Uploading', value: 40, max: 100 });

    expect(await axeViolations()).toEqual([]);
  });
});
