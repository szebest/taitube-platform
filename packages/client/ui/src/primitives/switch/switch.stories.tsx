import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Switch } from '.';
import { switchStyles } from './switch.variants';

const meta = {
  title: 'Primitives/Switch',
  component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StatesAndSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(switchStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:items-center tw:gap-stack">
          <Switch {...args} size={size} aria-label="Off" />
          <Switch {...args} size={size} aria-label="On" defaultChecked />
          <Switch {...args} size={size} aria-label="Disabled" disabled />
          <Switch {...args} size={size} aria-label="Disabled on" disabled defaultChecked />
        </div>
      ))}
    </div>
  ),
};
