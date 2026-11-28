import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { PartyCard } from '..';
import { PartyCardRoot } from '../party-card';

const meta = {
  title: 'Web/PartyCard',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: PartyCardRoot,
} satisfies Meta<typeof PartyCardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const FACES = [
  { name: 'Ana', avatarUrl: null },
  { name: 'Bruno', avatarUrl: null },
  { name: 'Carla', avatarUrl: null },
];

const Card = ({
  title = 'Movie night',
  ...props
}: { title?: string } & Partial<Parameters<typeof PartyCardRoot>[0]>) => (
  <PartyCard.Root className="w-80" {...props}>
    <PartyCard.Thumb progress={0.4}>
      <PartyCard.Pill tone="accent">Now playing</PartyCard.Pill>
    </PartyCard.Thumb>
    <PartyCard.Title asChild>
      <a href="/parties/1">{title}</a>
    </PartyCard.Title>
    <PartyCard.Host name="Ana" channelBadge="Ana's channel hosts" />
    <PartyCard.Roster faces={FACES} watching="12 watching" more={['+9', '+2 from Discord']} />
    <PartyCard.Meta>
      <span>12 / 20</span>
      <span>PL</span>
      <span>Playlist, 8 videos</span>
    </PartyCard.Meta>
    <PartyCard.Action>
      <span className="text-label">Join</span>
    </PartyCard.Action>
  </PartyCard.Root>
);

export const Open: Story = { render: (args) => <Card {...args} /> };

export const Full: Story = { render: (args) => <Card {...args} state="full" /> };

export const Ended: Story = { render: (args) => <Card {...args} state="ended" /> };

export const LongTitle: Story = {
  render: (args) => (
    <Card
      {...args}
      title="An exceedingly long watch party name that has to wrap onto a second line and then be cut"
    />
  ),
};
