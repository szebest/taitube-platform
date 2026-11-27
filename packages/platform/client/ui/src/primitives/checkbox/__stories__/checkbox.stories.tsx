import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from '..';
import { variantNames } from '../../../lib/variant-names';
import { checkboxStyles } from '../checkbox.variants';

const meta = {
  title: 'Primitives/Checkbox',
  tags: ['text'],
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StatesAndSizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack">
      {variantNames(checkboxStyles.variants.size).map((size) => (
        <div key={size} className="flex items-center gap-stack">
          <Checkbox {...args} size={size} aria-label="Unchecked" />
          <Checkbox {...args} size={size} aria-label="Checked" defaultChecked />
          <Checkbox {...args} size={size} aria-label="Indeterminate" checked="indeterminate" />
          <Checkbox {...args} size={size} aria-label="Disabled" disabled />
          <Checkbox {...args} size={size} aria-label="Disabled checked" disabled defaultChecked />
          <Checkbox {...args} size={size} aria-label="Invalid" aria-invalid />
        </div>
      ))}
    </div>
  ),
};
