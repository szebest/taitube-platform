import { DropdownMenu, Icon, IconButton } from '@kit/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { listMyWatchParties, getWatchParty } from '@vp/api-contracts';
import { partyPreview, partyRoom } from '@vp/web-testing';
import { PartyQueueMenuItem } from '..';

const meta = {
  title: 'Web/PartyQueueMenuItem',
  tags: ['text', 'translated'],
  component: PartyQueueMenuItem,
  args: { videoId: '0190c3a0-5e1d-7000-8000-00000000a001' },
  parameters: {
    app: {
      session: 'signed-in',
      api: () => [
        {
          contract: listMyWatchParties,
          body: () => ({ owning: [], joined: [partyRoom()], interested: [] }),
        },
        {
          contract: getWatchParty,
          body: () => partyPreview({ viewer: { permissions: ['queue.add'], canJoin: 'member' } }),
        },
      ],
    },
  },
  render: (args) => (
    <div className="p-section">
      <DropdownMenu.Root open>
        <DropdownMenu.Trigger asChild>
          <IconButton aria-label="More">
            <Icon name="more" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <PartyQueueMenuItem {...args} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  ),
} satisfies Meta<typeof PartyQueueMenuItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InAParty: Story = {};
