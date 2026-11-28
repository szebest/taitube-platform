import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { PartyControlsList } from '..';
import { PartyControlsListRoot } from '../party-controls-list';

const meta = {
  title: 'Web/PartyControlsList',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: PartyControlsListRoot,
} satisfies Meta<typeof PartyControlsListRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <div className="w-[26rem]">
      <PartyControlsList.Empty />
    </div>
  ),
};

export const Filled: Story = {
  render: (args) => (
    <div className="w-[26rem]">
      <PartyControlsListRoot {...args}>
        <PartyControlsList.Item name="user:ana" onRemove={() => undefined} />
        <PartyControlsList.Item name="discord:1234" onRemove={() => undefined} />
        <PartyControlsList.Item name="user:bruno" disabled onRemove={() => undefined} />
      </PartyControlsListRoot>
    </div>
  ),
};
