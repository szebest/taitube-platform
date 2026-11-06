import type { Meta, StoryObj } from '@storybook/react-vite';
import { CredentialField } from '../index';

const meta = {
  title: 'Studio/CredentialField',
  component: CredentialField.Root,
  args: { className: 'w-[28rem]' },
} satisfies Meta<typeof CredentialField.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  render: (args) => (
    <CredentialField.Root {...args}>
      <CredentialField.Label>Server URL</CredentialField.Label>
      <CredentialField.Value>rtmp://localhost:1935/live</CredentialField.Value>
      <CredentialField.Copy>Copy server URL</CredentialField.Copy>
    </CredentialField.Root>
  ),
};

export const Secret: Story = {
  render: (args) => (
    <CredentialField.Root {...args} secret>
      <CredentialField.Label>Stream key</CredentialField.Label>
      <CredentialField.Value>sk_live_0190c3a05e1d7000</CredentialField.Value>
      <div className="flex gap-inline">
        <CredentialField.Reveal showLabel="Reveal stream key" hideLabel="Hide stream key" />
        <CredentialField.Copy>Copy stream key</CredentialField.Copy>
      </div>
    </CredentialField.Root>
  ),
};
