import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountMenu } from '.';
import { AccountMenuTrigger } from './account-menu';

const meta = {
  title: 'Components/AccountMenu',
  component: AccountMenuTrigger,
  args: { name: 'The Creator' },
} satisfies Meta<typeof AccountMenuTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: (args) => (
    <div className="tw:flex tw:min-h-60 tw:justify-end">
      <AccountMenu.Root open modal={false}>
        <AccountMenu.Trigger {...args} />
        <AccountMenu.Content align="end">
          <AccountMenu.Label>The Creator</AccountMenu.Label>
          <AccountMenu.Item asChild>
            <a href="/upload">Upload</a>
          </AccountMenu.Item>
          <AccountMenu.Separator />
          <AccountMenu.Item>Sign out</AccountMenu.Item>
        </AccountMenu.Content>
      </AccountMenu.Root>
    </div>
  ),
};
