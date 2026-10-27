import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vp/ui';
import { LoginCard } from '.';
import { LoginCardRoot } from './login-card';

const meta = {
  title: 'Components/LoginCard',
  component: LoginCardRoot,
} satisfies Meta<typeof LoginCardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expired: Story = {
  render: (args) => (
    <LoginCard.Root {...args}>
      <LoginCard.Title>Sign in</LoginCard.Title>
      <LoginCard.Expired>Your session ended. Sign in again to carry on.</LoginCard.Expired>
      <LoginCard.Error>That did not work. Try again.</LoginCard.Error>
      <LoginCard.Body>
        <Button>Continue as a creator</Button>
      </LoginCard.Body>
    </LoginCard.Root>
  ),
};
