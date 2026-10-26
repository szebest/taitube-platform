import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../icon';
import { VisuallyHidden } from './visually-hidden';

const meta = {
  title: 'Primitives/VisuallyHidden',
  component: VisuallyHidden,
  args: { children: 'Notifications' },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NamesAnIcon: Story = {
  render: (args) => (
    <p className="tw:flex tw:items-center tw:gap-inline tw:text-body tw:text-fg">
      <Icon name="bell" />
      <VisuallyHidden {...args} />
      <span>Only the bell shows; a screen reader reads the hidden name.</span>
    </p>
  ),
};
