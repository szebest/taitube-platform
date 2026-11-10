import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { PartyRoom, type PartyRoomRootProps, type PartyRoomTab } from '..';
import { PartyRoomRoot } from '../party-room';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const meta = {
  title: 'Web/PartyRoom',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: PartyRoomRoot,
  render: (args) => <Room {...args} />,
} satisfies Meta<typeof PartyRoomRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

function Room(args: PartyRoomRootProps) {
  const [tab, setTab] = useState<PartyRoomTab>('chat');

  return (
    <PartyRoom.Root {...args}>
      <PartyRoom.Header>
        <h1 className="m-0 text-title-lg">Movie night</h1>
        <span className="text-body-sm text-fg-muted">Hosted by Ana</span>
      </PartyRoom.Header>
      <PartyRoom.Stage>
        <img src={POSTER} alt="" className="aspect-video w-full rounded-thumb object-cover" />
        <PartyRoom.Overlay>
          <p className="m-0 p-inset-card text-body-sm text-fg">Chat overlay</p>
        </PartyRoom.Overlay>
      </PartyRoom.Stage>
      <PartyRoom.Panel value={tab} onValueChange={setTab}>
        <PartyRoom.Tabs />
        <PartyRoom.TabPanel value="chat">Chat</PartyRoom.TabPanel>
        <PartyRoom.TabPanel value="people">People</PartyRoom.TabPanel>
        <PartyRoom.TabPanel value="queue">Queue</PartyRoom.TabPanel>
      </PartyRoom.Panel>
    </PartyRoom.Root>
  );
}

export const Side: Story = { args: { layout: 'side' } };
export const Below: Story = { args: { layout: 'below' } };
export const Theater: Story = { args: { layout: 'theater' } };
export const Focus: Story = { args: { layout: 'focus' } };
