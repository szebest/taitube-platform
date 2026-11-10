import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { withPartyIntl } from '#app/components/party/__stories__/with-party-intl';
import { MemberMenu } from '..';

const ROLES = [
  { id: 'r-dj', name: 'DJ', key: 'dj', position: 20, assigned: true },
  { id: 'r-vip', name: 'VIP', key: 'vip', position: 10, assigned: false },
  { id: 'r-cohost', name: 'Co-host', key: 'cohost', position: 80, assigned: false },
];

const meta = {
  title: 'Web/MemberMenu',
  decorators: [withPartyIntl],
  component: MemberMenu,
  args: {
    name: 'Bruno',
    member: { topPosition: 10, isOwner: false, kind: 'user' },
    roles: ROLES,
    onToggleRole: () => undefined,
    onMute: () => undefined,
    onKick: () => undefined,
    onBan: () => undefined,
    onTransfer: () => undefined,
  },
  render: (args) => (
    <PartyPermissionsProvider
      userContext={null}
      viewer={{
        permissions: [
          'chat.moderate',
          'voice.moderate',
          'members.kick',
          'members.ban',
          'roles.assign',
        ],
        topPosition: 50,
        isOwner: false,
        kind: 'user',
      }}
    >
      <MemberMenu {...args} />
    </PartyPermissionsProvider>
  ),
} satisfies Meta<typeof MemberMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Moderator: Story = {};
export const WithVoice: Story = { args: { voice: true } };
export const OwnerTransfer: Story = { args: { canTransfer: true } };
