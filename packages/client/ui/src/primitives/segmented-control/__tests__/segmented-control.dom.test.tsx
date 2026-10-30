import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { SegmentedControl } from '..';
import { variantNames } from '../../../lib/variant-names';
import type { SegmentedControlRootProps } from '../segmented-control';
import { segmentedControlStyles } from '../segmented-control.variants';

const renderSegmentedControl = (props: SegmentedControlRootProps = {}) => {
  const onValueChange = vi.fn();
  const user = userEvent.setup();
  return {
    user,
    onValueChange,
    ...render(
      <SegmentedControl.Root
        aria-label="Comment order"
        defaultValue="top"
        onValueChange={onValueChange}
        {...props}
      >
        <SegmentedControl.Item value="top">Top</SegmentedControl.Item>
        <SegmentedControl.Item value="newest">Newest</SegmentedControl.Item>
        <SegmentedControl.Item value="oldest" disabled>
          Oldest
        </SegmentedControl.Item>
      </SegmentedControl.Root>
    ),
  };
};

describe('@vp/ui: SegmentedControl', () => {
  it.each(variantNames(segmentedControlStyles.variants.tone))(
    'is a %s radio group with one tab stop on the selected option, and selecting changes it',
    async (tone) => {
      const { user, onValueChange } = renderSegmentedControl({ tone });

      await user.tab();
      expect(screen.getByRole('radio', { name: 'Top' })).toHaveFocus();
      await user.click(screen.getByRole('radio', { name: 'Newest' }));

      expect(screen.getByRole('radiogroup', { name: 'Comment order' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked();
      expect(onValueChange).toHaveBeenCalledWith('newest');
    }
  );

  it('passes axe', async () => {
    renderSegmentedControl();

    expect(await axeViolations()).toEqual([]);
  });
});
