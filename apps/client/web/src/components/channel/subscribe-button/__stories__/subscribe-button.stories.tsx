import type { Meta, StoryObj } from '@storybook/react-vite';
import { SubscribeButton } from '../subscribe-button';

const meta = {
  title: 'Web/SubscribeButton',
  tags: ['text', 'translated'],
  component: SubscribeButton,
  args: { subscribed: false, onToggle: () => undefined, children: 'Subscribe' },
} satisfies Meta<typeof SubscribeButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotSubscribed: Story = {};

export const Subscribed: Story = {
  args: { subscribed: true, children: 'Subscribed' },
};

export const Pending: Story = {
  tags: ['motion'],
  args: { subscribed: true, pending: true, children: 'Subscribed' },
};
