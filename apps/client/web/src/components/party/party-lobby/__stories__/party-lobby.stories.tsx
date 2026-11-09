import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import type { ReactNode } from 'react';
import { PartyLobby, type PartyLobbyMember } from '..';
import { PartyLobbyRoot } from '../party-lobby';

const MEMBERS: PartyLobbyMember[] = [
  { key: 'user:1', name: 'Ana', avatarUrl: null, ready: true },
  { key: 'user:2', name: 'Bruno', avatarUrl: null, ready: false },
  { key: 'user:3', name: 'Carla', avatarUrl: null, ready: true },
];

function AsHost({ children }: { children: ReactNode }) {
  return (
    <PartyPermissionsProvider
      userContext={null}
      viewer={{ permissions: ['playback.control'], topPosition: 100, isOwner: true, kind: 'user' }}
    >
      <div className="w-[48rem] max-w-full">{children}</div>
    </PartyPermissionsProvider>
  );
}

const meta = {
  title: 'Web/PartyLobby',
  tags: ['text'],
  component: PartyLobbyRoot,
} satisfies Meta<typeof PartyLobbyRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  render: (args) => (
    <AsHost>
      <PartyLobby.Root {...args}>
        <PartyLobby.Status />
        <PartyLobby.ReadyCheck members={MEMBERS} guests={2} />
        <PartyLobby.Actions
          ready={false}
          onToggleReady={() => undefined}
          onStart={() => undefined}
        />
      </PartyLobby.Root>
    </AsHost>
  ),
};

export const Scheduled: Story = {
  render: (args) => (
    <AsHost>
      <PartyLobby.Root {...args}>
        <PartyLobby.Status startsAt="Fri 20:00" />
        <PartyLobby.ReadyCheck members={MEMBERS} />
        <PartyLobby.Actions ready onToggleReady={() => undefined} onStart={() => undefined} />
      </PartyLobby.Root>
    </AsHost>
  ),
};

export const Countdown: Story = {
  render: (args) => (
    <AsHost>
      <PartyLobby.Root {...args}>
        <PartyLobby.Countdown seconds={3} />
        <PartyLobby.ReadyCheck members={MEMBERS.map((member) => ({ ...member, ready: true }))} />
      </PartyLobby.Root>
    </AsHost>
  ),
};
