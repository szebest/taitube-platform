import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Spinner, spinnerVariants } from '../spinner';
import { variantNames } from '../lib/variant-names';
import { WithUiCopy } from './ui-copy-fixture';

const SIZES = variantNames(spinnerVariants.variants.size);

function renderSpinner(props: Partial<ComponentProps<typeof Spinner>> = {}) {
  return render(<Spinner {...{ children: 'Loading comments', ...props }} />, {
    wrapper: WithUiCopy,
  });
}

describe('@vp/ui: Spinner', () => {
  it.each(SIZES)('announces what is loading at size %s', (size) => {
    renderSpinner({ size });

    expect(screen.getByRole('status', { name: 'Loading comments' })).toBeInTheDocument();
  });

  it('announces the UiCopy loading word when it is not told what is loading', () => {
    renderSpinner({ children: undefined });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('stops spinning for a viewer who asked for reduced motion', () => {
    renderSpinner();

    expect(screen.getByRole('status')).toHaveClass(
      'tw:animate-spin',
      'tw:motion-reduce:animate-none'
    );
  });

  it('passes axe', async () => {
    renderSpinner();

    expect(await axeViolations()).toEqual([]);
  });
});
