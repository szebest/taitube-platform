import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { Roster } from '#app/components/party/roster';
import { PartyChat, type PartyChatComposerProps } from '..';
import { PartyChatRoot, type PartyChatRootProps } from '../party-chat';

const meta = {
  title: 'Web/PartyChat',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: PartyChatRoot,
  args: { onSend: () => undefined },
} satisfies Meta<typeof PartyChatRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const chat =
  (composer: PartyChatComposerProps, hidden = false) =>
  (args: PartyChatRootProps) => (
    <div className="h-[28rem]">
      <PartyChatRoot {...args}>
        <PartyChat.List>
          <PartyChat.Line author="Ana" badges={<Roster.RoleBadge name="Host" colour="#c9772f" />}>
            Starting in a minute
          </PartyChat.Line>
          <PartyChat.Line author="Bruno" hidden={hidden} onShow={() => undefined}>
            That opening shot
          </PartyChat.Line>
          <PartyChat.Line author="system" system>
            Carla joined
          </PartyChat.Line>
        </PartyChat.List>
        <PartyChat.Composer {...composer} />
      </PartyChatRoot>
    </div>
  );

export const Open: Story = { render: chat({ state: 'open', maxLength: 200 }) };
export const HiddenAuthor: Story = { render: chat({ state: 'open' }, true) };
export const MutedUntil: Story = { render: chat({ state: 'muted', mutedUntil: '20:15' }) };
export const MutedForParty: Story = { render: chat({ state: 'muted' }) };
export const ChatOff: Story = { render: chat({ state: 'off' }) };
export const Offline: Story = { render: chat({ state: 'offline' }) };
export const Guest: Story = { render: chat({ state: 'guest', onSignIn: () => undefined }) };
