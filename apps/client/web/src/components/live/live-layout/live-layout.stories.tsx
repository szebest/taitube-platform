import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@vp/ui';
import { LiveChat, LiveChatSkeleton } from '../live-chat';
import { Stage, StageSkeleton } from '#app/components/watch/stage';
import { LiveLayout } from '.';
import { LiveLayoutRoot } from './live-layout';

const STREAM = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const LINES = [
  ['ines', 'The tram!'],
  ['lis', 'Is this the 28 or the 12?'],
  ['joao', 'That light on the river is unreal'],
  ['ana', 'Watching from Porto, hello everyone'],
] as const;

const chat = (layout: 'docked' | 'overlay') => (
  <LiveChat.Root layout={layout} onSend={() => undefined}>
    <LiveChat.Header>
      <h2 className="tw:m-0 tw:flex-1 tw:text-label">Live chat</h2>
      <LiveChat.Menu>
        <LiveChat.Opacity />
      </LiveChat.Menu>
    </LiveChat.Header>
    <LiveChat.List>
      {LINES.map(([author, text]) => (
        <LiveChat.Message key={text} author={author}>
          {text}
        </LiveChat.Message>
      ))}
    </LiveChat.List>
    <LiveChat.Composer maxLength={200} />
  </LiveChat.Root>
);

const details = (
  <LiveLayout.Details>
    <h1 className="tw:m-0 tw:text-title-lg">Lisbon trams at dusk</h1>
    <p className="tw:m-0 tw:flex tw:items-center tw:gap-inline tw:text-body-sm tw:text-fg-muted">
      <Badge variant="solid" tone="live">
        Live
      </Badge>
      1.2K watching
    </p>
  </LiveLayout.Details>
);

const meta = {
  title: 'Web/LiveLayout',
  tags: ['text'],
  component: LiveLayoutRoot,
} satisfies Meta<typeof LiveLayoutRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Docked: Story = {
  render: (args) => (
    <LiveLayout.Root {...args}>
      <LiveLayout.Stage>
        <Stage.Root>
          <Stage.Poster src={STREAM} alt="Lisbon trams at dusk" />
        </Stage.Root>
      </LiveLayout.Stage>
      <LiveLayout.Chat>{chat('docked')}</LiveLayout.Chat>
      {details}
    </LiveLayout.Root>
  ),
};

export const Overlay: Story = {
  args: { chat: 'overlay' },
  render: (args) => (
    <LiveLayout.Root {...args}>
      <LiveLayout.Stage>
        <Stage.Root>
          <Stage.Poster src={STREAM} alt="Lisbon trams at dusk" />
          {chat('overlay')}
        </Stage.Root>
      </LiveLayout.Stage>
      <LiveLayout.Chat>{chat('docked')}</LiveLayout.Chat>
      {details}
    </LiveLayout.Root>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <LiveLayout.Root {...args} aria-hidden="true">
      <LiveLayout.Stage>
        <StageSkeleton />
      </LiveLayout.Stage>
      <LiveLayout.Chat>
        <LiveChatSkeleton />
      </LiveLayout.Chat>
    </LiveLayout.Root>
  ),
};
