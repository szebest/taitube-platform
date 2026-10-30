import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignedOutSection } from '.';
import { SignedOutSectionRoot } from './signed-out-section';

const meta = {
  title: 'Web/SignedOutSection',
  component: SignedOutSectionRoot,
} satisfies Meta<typeof SignedOutSectionRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ForAGuest: Story = {
  render: (args) => (
    <SignedOutSection.Root {...args}>
      <SignedOutSection.Line asChild>
        <h2>The channels you follow live here</h2>
      </SignedOutSection.Line>
      <SignedOutSection.Action asChild>
        <a href="/login">Sign in</a>
      </SignedOutSection.Action>
    </SignedOutSection.Root>
  ),
};
