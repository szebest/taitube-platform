import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Checkbox } from '.';
import { checkboxStyles } from './checkbox.variants';

const meta = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StatesAndSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(checkboxStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:items-center tw:gap-stack">
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
