import type { Meta, StoryObj } from '@storybook/react-vite';
import { SecretReveal } from '../index';

const TOKEN =
  'tt_pat_0a1b2c3d_5f0e4b2a9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';

const meta = {
  title: 'Studio/SecretReveal',
  component: SecretReveal.Root,
  args: { value: TOKEN, className: 'w-[32rem] max-w-full' },
} satisfies Meta<typeof SecretReveal.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Fresh: Story = {
  render: (args) => (
    <SecretReveal.Root {...args}>
      <SecretReveal.Notice>
        Copy this token now. Once you close this, nobody can show it to you again.
      </SecretReveal.Notice>
      <SecretReveal.Label>Nightly analytics sync</SecretReveal.Label>
      <div className="flex items-center gap-inline">
        <SecretReveal.Value />
        <SecretReveal.Copy onCopy={() => undefined} />
      </div>
      <SecretReveal.Acknowledge>I saved this token somewhere safe</SecretReveal.Acknowledge>
      <div className="flex justify-end">
        <SecretReveal.Done>Done</SecretReveal.Done>
      </div>
    </SecretReveal.Root>
  ),
};

export const WebhookSecret: Story = {
  args: { value: '3f9c1e7a5b2d8f4e6a0c9b1d7e3f5a2c8b4d6e0f1a9c7b5d3e2f8a6c4b0d1e9f' },
  render: Fresh.render,
};
