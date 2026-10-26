import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { variantNames } from '../../../lib/variant-names';
import { Spinner, type SpinnerProps } from '../spinner';
import { spinnerStyles } from '../spinner.variants';

const renderSpinner = (props: Partial<SpinnerProps> = {}) =>
  render(<Spinner {...{ children: 'Loading comments', ...props }} />, { wrapper: WithUiCopy });

describe('@vp/ui: Spinner', () => {
  it.each(variantNames(spinnerStyles.variants.size))(
    'announces what is loading at size %s',
    (size) => {
      renderSpinner({ size });

      expect(screen.getByRole('status')).toHaveTextContent('Loading comments');
    }
  );

  it('announces the UiCopy loading word when it is not told what is loading', () => {
    renderSpinner({ children: undefined });

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('turns only for a viewer who has not asked for reduced motion', () => {
    const { container } = renderSpinner();

    expect(container.querySelector('svg')).toHaveClass('tw:motion-safe:animate-spin');
  });

  it('passes axe', async () => {
    renderSpinner({ tone: 'accent' });

    expect(await axeViolations()).toEqual([]);
  });
});
