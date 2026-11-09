import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoleBadge } from '../role-badge';

const meta = {
  title: 'Studio/RoleBadge',
  component: RoleBadge,
  args: { channelRole: 'editor', children: 'Editor' },
} satisfies Meta<typeof RoleBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Editor: Story = {};

export const Manager: Story = { args: { channelRole: 'manager', children: 'Manager' } };

export const Moderator: Story = { args: { channelRole: 'moderator', children: 'Moderator' } };

export const Analytics: Story = {
  args: { channelRole: 'analytics', children: 'Analytics viewer' },
};
