import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '..';
import { variantNames } from '../../../lib/variant-names';
import { switchStyles } from '../switch.variants';

const meta = {
  title: 'Primitives/Switch',
  tags: ['text'],
  component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StatesAndSizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack">
      {variantNames(switchStyles.variants.size).map((size) => (
        <div key={size} className="flex items-center gap-stack">
          <Switch {...args} size={size} aria-label="Off" />
          <Switch {...args} size={size} aria-label="On" defaultChecked />
          <Switch {...args} size={size} aria-label="Disabled" disabled />
          <Switch {...args} size={size} aria-label="Disabled on" disabled defaultChecked />
        </div>
      ))}
    </div>
  ),
};
