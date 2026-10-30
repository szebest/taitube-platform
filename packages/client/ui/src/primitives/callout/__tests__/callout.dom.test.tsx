import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Callout } from '..';
import type { CalloutRootProps } from '../callout';
import { calloutStyles } from '../callout.variants';

const renderCallout = (props: CalloutRootProps = {}) =>
  render(
    <Callout.Root role="status" {...props}>
      <Callout.Icon />
      <Callout.Title>Processing is slow</Callout.Title>
      <Callout.Body>Your 4K upload may take a few minutes.</Callout.Body>
      <Callout.Action>
        <button type="button">Keep waiting</button>
      </Callout.Action>
    </Callout.Root>
  );

describe('@vp/ui: Callout', () => {
  it.each([
    { tone: 'success', icon: 'check' },
    { tone: 'warning', icon: 'alert' },
    { tone: 'info', icon: 'info' },
  ] as const)('carries the $tone glyph, $icon, beside its words', ({ tone, icon }) => {
    const { container } = renderCallout({ tone });

    expect(screen.getByRole('status')).toHaveTextContent('Processing is slow');
    expect(container.querySelector('[data-slot="callout-icon"]')).toHaveAttribute(
      'data-icon',
      icon
    );
  });

  it('passes axe in every fill and tone', async () => {
    for (const variant of variantNames(calloutStyles.variants.variant)) {
      for (const tone of variantNames(calloutStyles.variants.tone)) {
        renderCallout({ variant, tone, role: undefined });
      }
    }

    expect(await axeViolations()).toEqual([]);
  });
});
