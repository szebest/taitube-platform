import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { ToggleGroup } from '..';
import { toggleGroupStyles } from '../toggle-group.variants';
import type { ToggleFill } from '../types';

const renderToggleGroup = (props: { variant?: ToggleFill } = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <ToggleGroup.Root type="multiple" aria-label="Text style" {...props}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
        <ToggleGroup.Item value="underline" disabled>
          Underline
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    ),
  };
};

describe('@vp/ui: ToggleGroup', () => {
  it.each(variantNames(toggleGroupStyles.variants.variant))(
    'toggles a %s item on and off with Space, as one tab stop',
    async (variant) => {
      const { user } = renderToggleGroup({ variant });

      await user.tab();
      await user.keyboard('[Space]');
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('[Space]');
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
    }
  );

  it('moves with the arrows, skipping a disabled item', async () => {
    const { user } = renderToggleGroup();
    await user.tab();

    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus();
  });

  it('passes axe', async () => {
    renderToggleGroup({ variant: 'outline' });

    expect(await axeViolations()).toEqual([]);
  });
});
