import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { Roster } from '..';
import { RosterRoot } from '../roster';

const meta = {
  title: 'Web/Roster',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: RosterRoot,
} satisfies Meta<typeof RosterRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  render: (args) => (
    <Roster.Root {...args} className="w-[22.5rem]">
      <Roster.Group label="Present" count={3}>
        <Roster.Member
          name="Ana"
          owner
          ready
          sync="in_sync"
          badges={<Roster.RoleBadge name="Host" colour="#c9772f" />}
        />
        <Roster.Member name="Bruno" source="discord_chat" sync="catching_up" />
        <Roster.Member
          name="Carla"
          sync="buffering"
          badges={<Roster.RoleBadge name="DJ" colour="#3b82c4" />}
        />
      </Roster.Group>
      <Roster.Group label="Away" count={1}>
        <Roster.Member name="Davi" away sync="lobby" />
      </Roster.Group>
      <Roster.Guests count={4} />
    </Roster.Root>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Roster.Root {...args} className="w-[22.5rem]">
      <Roster.Guests count={0} />
    </Roster.Root>
  ),
};
