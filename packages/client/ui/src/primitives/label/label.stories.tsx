import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Label } from './label';
import { labelStyles } from './label.variants';

const meta = {
  title: 'Primitives/Label',
  component: Label,
  args: { children: 'Video title' },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SizesAndStates: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-80 tw:flex-col tw:gap-stack">
      {variantNames(labelStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:flex-col tw:gap-inline">
          <Label {...args} size={size} htmlFor={`title-${size}`} />
          <input
            id={`title-${size}`}
            className="tw:h-control-md tw:rounded-control tw:border-control tw:border-border-strong tw:bg-bg tw:px-inset-control tw:text-fg"
          />
        </div>
      ))}
      <div className="tw:flex tw:items-center tw:gap-inline">
        <input id="notify" type="checkbox" disabled className="tw:peer" />
        <Label htmlFor="notify">Notify subscribers (disabled)</Label>
      </div>
      <Label>
        A long label that wraps onto a second line rather than being cut off at the edge
      </Label>
    </div>
  ),
};
