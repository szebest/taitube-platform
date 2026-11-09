import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import type { ReactNode } from 'react';
import { PartyQueue } from '..';
import { PartyQueueRoot } from '../party-queue';

function AsDj({ children }: { children: ReactNode }) {
  return (
    <PartyPermissionsProvider
      userContext={null}
      viewer={{
        permissions: ['queue.add', 'queue.remove'],
        topPosition: 20,
        isOwner: false,
        kind: 'user',
      }}
    >
      <div className="w-[22.5rem]">{children}</div>
    </PartyPermissionsProvider>
  );
}

const meta = {
  title: 'Web/PartyQueue',
  tags: ['text'],
  component: PartyQueueRoot,
} satisfies Meta<typeof PartyQueueRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  render: (args) => (
    <AsDj>
      <PartyQueue.Root {...args}>
        <PartyQueue.List>
          <PartyQueue.Item title="Big Buck Bunny" addedBy="Ana" current />
          <PartyQueue.Item title="Sintel" addedBy="Bruno" onRemove={() => undefined} />
          <PartyQueue.Item title="Tears of Steel" addedBy="Carla" onRemove={() => undefined} />
        </PartyQueue.List>
        <PartyQueue.Add onAdd={() => undefined} />
      </PartyQueue.Root>
    </AsDj>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <AsDj>
      <PartyQueue.Root {...args}>
        <PartyQueue.Empty />
        <PartyQueue.Add onAdd={() => undefined} />
      </PartyQueue.Root>
    </AsDj>
  ),
};
