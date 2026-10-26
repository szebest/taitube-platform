import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Chip, ChipGroup } from '..';
import { variantNames } from '../../../lib/variant-names';
import { chipStyles } from '../chip.variants';

const renderChipGroup = () => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <ChipGroup.Root type="single" aria-label="Category" defaultValue="all">
        <ChipGroup.Item value="all">All</ChipGroup.Item>
        <ChipGroup.Item value="music">Music</ChipGroup.Item>
      </ChipGroup.Root>
    ),
  };
};

describe('@vp/ui: Chip', () => {
  it.each(variantNames(chipStyles.variants.variant))(
    'is a %s toggle button reporting its pressed state',
    (variant) => {
      render(
        <Chip variant={variant} aria-pressed="true">
          Live
        </Chip>
      );

      expect(screen.getByRole('button', { name: 'Live', pressed: true })).toHaveClass(
        'tw:focus-ring'
      );
    }
  );

  it('styles a link and keeps its aria-current', () => {
    render(
      <Chip asChild>
        <a href="/music" aria-current="true">
          Music
        </a>
      </Chip>
    );

    expect(screen.getByRole('link', { name: 'Music' })).toHaveAttribute('aria-current', 'true');
  });

  it('selects one chip of a group with the arrows', async () => {
    const { user } = renderChipGroup();

    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(screen.getByRole('radio', { name: 'Music' })).toBeChecked();
  });

  it('passes axe', async () => {
    renderChipGroup();

    expect(await axeViolations()).toEqual([]);
  });
});
