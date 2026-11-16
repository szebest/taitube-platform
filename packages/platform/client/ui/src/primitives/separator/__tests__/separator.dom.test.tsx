import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Separator, type SeparatorProps } from '../separator';
import { separatorStyles } from '../separator.variants';

const renderSeparator = (props: SeparatorProps = {}) => render(<Separator {...props} />);

describe('@vp/ui: Separator', () => {
  it.each(variantNames(separatorStyles.variants.orientation))(
    'is a %s separator when it divides content',
    (orientation) => {
      renderSeparator({ orientation, decorative: false });

      const separator = screen.getByRole('separator');
      expect(separator.getAttribute('aria-orientation') ?? 'horizontal').toBe(orientation);
    }
  );

  it('is skipped by assistive technology when it is only decoration', () => {
    renderSeparator();

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderSeparator({ decorative: false, tone: 'strong' });

    expect(await axeViolations()).toEqual([]);
  });
});
