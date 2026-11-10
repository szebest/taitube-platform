import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { screen } from '@testing-library/dom';
import { DropdownMenu, Icon, IconButton } from '@vp/ui';
import { FeedbackMenuItems } from '..';

const CHANNEL = {
  id: '0190c3a0-5e1d-7000-8000-00000000c001',
  handle: 'martareis',
  displayName: 'Marta Reis Films',
  avatarUrl: null,
};

const inOpenMenu: Decorator = (Story) => (
  <div className="flex min-h-48 justify-end p-section">
    <DropdownMenu.Root open modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label="More actions" size="sm">
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <Story />
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
);

const meta = {
  title: 'Web/FeedbackMenuItems',
  tags: ['text', 'translated'],
  component: FeedbackMenuItems,
  args: { video: { id: '0190c3a0-5e1d-7000-8000-00000000a001', channel: CHANNEL } },
  parameters: { app: { session: 'signed-in' }, layout: 'fullscreen' },
  decorators: [inOpenMenu],
} satisfies Meta<typeof FeedbackMenuItems>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VideoAndChannel: Story = {};

export const WithoutChannel: Story = {
  args: { video: { id: '0190c3a0-5e1d-7000-8000-00000000a001', channel: null } },
};

export const ItemHighlighted: Story = {
  play: async ({ userEvent }) => {
    const [first] = await screen.findAllByRole('menuitem');
    if (first) await userEvent.hover(first);
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};
