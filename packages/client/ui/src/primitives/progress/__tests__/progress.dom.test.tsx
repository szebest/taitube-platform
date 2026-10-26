import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Progress, type ProgressProps } from '../progress';
import { progressStyles } from '../progress.variants';

const renderProgress = (props: ProgressProps = {}) =>
  render(<Progress aria-label="Uploading launch.mp4" {...props} />);

describe('@vp/ui: Progress', () => {
  it.each(variantNames(progressStyles.variants.size))(
    'reports how far a %s bar has got and fills that share of it',
    (size) => {
      const { container } = renderProgress({ value: 40, size });

      const bar = screen.getByRole('progressbar', { name: 'Uploading launch.mp4' });
      expect(bar).toHaveAttribute('aria-valuenow', '40');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
      expect(container.querySelector('[data-slot="progress-indicator"]')).toHaveStyle({
        inlineSize: '40%',
      });
    }
  );

  it('is indeterminate without a value', () => {
    renderProgress();

    const bar = screen.getByRole('progressbar', { name: 'Uploading launch.mp4' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('data-state', 'indeterminate');
  });

  it('passes axe', async () => {
    renderProgress({ value: 40, tone: 'neutral' });

    expect(await axeViolations()).toEqual([]);
  });
});
