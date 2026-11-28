import { Button, Icon } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { screen } from '@testing-library/dom';
import { createWatchParty, listWatchPartyInviteCandidates } from '@vp/api-contracts';
import { partyRoom } from '@vp/web-testing';
import { WatchTogether } from '..';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';

const candidate = (n: number, flags: { inRoom?: boolean; invited?: boolean } = {}) => ({
  userId: `0190c3a0-5e1d-7000-8000-00000000d00${n}`,
  handle: `viewer${n}`,
  displayName: ['Ana Reis', 'Tom Lindqvist', 'Marta Kowalska'][n - 1] ?? null,
  avatarUrl: null,
  reason: 'co_watcher' as const,
  inRoom: flags.inRoom ?? false,
  invited: flags.invited ?? false,
});

const answers = () => [
  { contract: createWatchParty, body: () => partyRoom() },
  {
    contract: listWatchPartyInviteCandidates,
    body: () => ({
      items: [candidate(1), candidate(2, { invited: true }), candidate(3, { inRoom: true })],
    }),
  },
];

const padded: Decorator = (Story) => (
  <div className="p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/WatchTogether',
  tags: ['text', 'translated'],
  component: WatchTogether.Root,
  args: {
    source: () => ({ kind: 'video', videoId: VIDEO_ID }),
    children: (
      <WatchTogether.Trigger>
        <Button variant="soft">
          <Icon name="party" />
          Watch together
        </Button>
      </WatchTogether.Trigger>
    ),
  },
  parameters: { app: { session: 'signed-in', api: answers }, layout: 'fullscreen' },
  decorators: [padded],
} satisfies Meta<typeof WatchTogether.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const opens: Story['play'] = async ({ canvas, userEvent }) => {
  await userEvent.click(await canvas.findByRole('button', { name: 'Watch together' }));
  await screen.findByRole('dialog');
};

export const Trigger: Story = {};

export const Ready: Story = {
  tags: ['motion'],
  play: async (context) => {
    await opens(context);
    await screen.findByRole('button', { name: 'Copy link' });
  },
};

export const MakingTheRoom: Story = {
  parameters: {
    app: {
      session: 'signed-in',
      api: () => [{ contract: createWatchParty, body: () => new Promise(() => undefined) }],
    },
  },
  play: opens,
};

export const Failed: Story = {
  parameters: { app: { session: 'signed-in', api: () => [] } },
  play: async (context) => {
    await opens(context);
    await screen.findByRole('alert');
  },
};

export const StartsAtThePlayhead: Story = {
  args: { source: () => ({ kind: 'video', videoId: VIDEO_ID, startMs: 83_000 }) },
  play: async (context) => {
    await opens(context);
    await screen.findByRole('checkbox', { name: 'Start at 1:23' });
  },
};

export const SignedOut: Story = {
  parameters: { app: { session: 'guest' } },
};
