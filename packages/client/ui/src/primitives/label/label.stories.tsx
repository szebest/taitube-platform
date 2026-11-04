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
    <div className="flex max-w-80 flex-col gap-stack">
      {variantNames(labelStyles.variants.size).map((size) => (
        <div key={size} className="flex flex-col gap-inline">
          <Label {...args} size={size} htmlFor={`title-${size}`} />
          <input
            id={`title-${size}`}
            className="h-control-md rounded-control border-control border-border-strong bg-bg px-inset-control text-fg"
          />
        </div>
      ))}
      <div className="flex items-center gap-inline">
        <input id="notify" type="checkbox" disabled className="peer" />
        <Label htmlFor="notify">Notify subscribers (disabled)</Label>
      </div>
      <Label>
        A long label that wraps onto a second line rather than being cut off at the edge
      </Label>
    </div>
  ),
};
