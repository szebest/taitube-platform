import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Badge, type BadgeProps } from '../badge';
import { badgeStyles } from '../badge.variants';

const renderBadge = (props: BadgeProps = {}) => render(<Badge {...{ children: '4K', ...props }} />);

describe('@vp/ui: Badge', () => {
  it.each(variantNames(badgeStyles.variants.variant))(
    'reads its %s label as plain text',
    (variant) => {
      renderBadge({ variant });

      expect(screen.getByText('4K')).toHaveAttribute('data-slot', 'badge');
    }
  );

  it('draws a live badge on the live ground with a pulsing dot that assistive technology skips', () => {
    renderBadge({ tone: 'live', variant: 'outline', children: 'Live' });

    const badge = screen.getByText('Live');
    expect(badge).toHaveClass('tw:bg-live', 'tw:text-on-live');
    expect(badge.querySelector('[aria-hidden="true"]')).toHaveClass(
      'tw:motion-safe:animate-live-pulse'
    );
  });

  it('passes axe in every fill and tone', async () => {
    for (const variant of variantNames(badgeStyles.variants.variant)) {
      for (const tone of variantNames(badgeStyles.variants.tone)) {
        renderBadge({ variant, tone, children: `${variant} ${tone}` });
      }
    }

    expect(await axeViolations()).toEqual([]);
  });
});
