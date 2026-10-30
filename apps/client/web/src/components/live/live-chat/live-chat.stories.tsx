import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { waitFor } from '@testing-library/dom';
import { Badge, Callout } from '@vp/ui';
import { LiveChat, LiveChatSkeleton } from '.';
import { LiveChatRoot } from './live-chat';
import type { LiveChatMessageState, LiveChatRole } from './types';

const avatar = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${fill}"/></svg>`
  )}`;

const STREAM = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

type Line = {
  id: string;
  author: string;
  text: string;
  role?: LiveChatRole;
  state?: LiveChatMessageState;
};

const TEN: Line[] = [
  { id: '1', author: 'ines', text: 'The tram!' },
  { id: '2', author: 'lis', text: 'Is this the 28 or the 12?' },
  { id: '3', author: 'marta', text: 'The 28, heading up to Graça.', role: 'creator' },
  { id: '4', author: 'joao', text: 'That light on the river is unreal' },
  { id: '5', author: 'ana', text: 'Watching from Porto, hello everyone' },
  { id: '6', author: 'tomas', text: 'What camera is this?' },
  { id: '7', author: 'rui', text: 'Please keep it kind in here', role: 'moderator' },
  { id: '8', author: 'beatriz', text: 'The miradouro next, please' },
  { id: '9', author: 'ines', text: 'Saving this one for later' },
  { id: '10', author: 'lis', text: 'Same time next week?' },
];

const FILLS = ['#c9772f', '#7aa7d9', '#5a2a12', '#3d6aa1'];

const messages = (lines: Line[]) =>
  lines.map((line, index) => (
    <LiveChat.Message
      key={line.id}
      author={line.author}
      avatarSrc={avatar(FILLS[index % FILLS.length] ?? '#c9772f')}
      role={line.role}
      state={line.state}
      onRetry={() => undefined}
    >
      {line.text}
    </LiveChat.Message>
  ));

const header = (
  <LiveChat.Header>
    <h2 className="tw:m-0 tw:flex-1 tw:text-label">Live chat</h2>
    <span className="tw:text-mono tw:text-fg-muted">1.2K watching</span>
    <LiveChat.Menu>
      <LiveChat.Opacity />
    </LiveChat.Menu>
  </LiveChat.Header>
);

const inPanel: Decorator = (Story) => (
  <div className="tw:flex tw:h-[32rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/LiveChat',
  component: LiveChatRoot,
  args: { onSend: () => undefined },
  decorators: [inPanel],
} satisfies Meta<typeof LiveChatRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DockedWithTenMessages: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.List>{messages(TEN)}</LiveChat.List>
      <LiveChat.Composer maxLength={200} />
    </LiveChat.Root>
  ),
};

export const Pinned: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.Pinned>
        <span className="tw:text-label">marta</span> The route map is in the description.
      </LiveChat.Pinned>
      <LiveChat.List>{messages(TEN.slice(0, 5))}</LiveChat.List>
      <LiveChat.Composer />
    </LiveChat.Root>
  ),
};

export const OverlayAtSixtyPercent: Story = {
  args: { layout: 'overlay', defaultOpacity: 60 },
  render: (args) => (
    <div className="tw:relative tw:w-full tw:overflow-hidden tw:rounded-card tw:bg-media">
      <img src={STREAM} alt="" className="tw:block tw:size-full tw:object-cover" />
      <Badge variant="solid" tone="live" className="tw:absolute tw:start-inline tw:top-inline">
        LIVE
      </Badge>
      <LiveChat.Root {...args}>
        {header}
        <LiveChat.List>{messages(TEN)}</LiveChat.List>
        <LiveChat.Composer />
      </LiveChat.Root>
    </div>
  ),
};

export const ScrolledUp: Story = {
  render: DockedWithTenMessages.render,
  play: async ({ canvas, canvasElement }) => {
    const list = canvasElement.querySelector<HTMLElement>('[data-slot="live-chat-list"]');
    if (!list) {
      throw new Error('the story renders no log');
    }
    await waitFor(() => {
      if (list.scrollTop === 0) {
        throw new Error('the log has not scrolled to its newest message yet');
      }
    });
    list.scrollTop = 0;
    await canvas.findByRole('button', { name: 'Jump to latest' });
  },
};

export const PendingAndFailed: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.List>
        {messages([
          ...TEN.slice(0, 4),
          { id: 'p', author: 'you', text: 'On my way there now', state: 'pending' },
          { id: 'f', author: 'you', text: 'Which stop is that?', state: 'failed' },
          { id: 'r', author: 'spam', text: 'removed', state: 'removed' },
        ])}
      </LiveChat.List>
      <LiveChat.Composer />
    </LiveChat.Root>
  ),
};

export const SlowMode: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.List>{messages(TEN.slice(0, 6))}</LiveChat.List>
      <LiveChat.Composer wait="Slow mode: you can send again in 12 seconds" />
    </LiveChat.Root>
  ),
};

export const Disconnected: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <Callout.Root tone="warning" className="tw:m-inline">
        <Callout.Icon name="wifi-off" />
        <Callout.Body>You are offline. Chat comes back when the connection does.</Callout.Body>
      </Callout.Root>
      <LiveChat.List>{messages(TEN.slice(0, 6))}</LiveChat.List>
      <LiveChat.Composer disabled />
    </LiveChat.Root>
  ),
};

export const CreatorAndModeratorRoles: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.List>
        {messages(TEN.filter((line) => line.role !== undefined || line.id === '1'))}
      </LiveChat.List>
      <LiveChat.Composer />
    </LiveChat.Root>
  ),
};

export const Ended: Story = {
  render: (args) => (
    <LiveChat.Root {...args}>
      {header}
      <LiveChat.List>{messages(TEN.slice(0, 6))}</LiveChat.List>
      <LiveChat.Ended />
    </LiveChat.Root>
  ),
};

export const CompactPortrait: Story = {
  globals: { viewport: { value: 'mobile1' } },
  decorators: [
    (Story) => (
      <div className="tw:flex tw:h-[40vh]">
        <Story />
      </div>
    ),
  ],
  render: DockedWithTenMessages.render,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: DockedWithTenMessages.render,
};

export const Skeleton: Story = {
  render: () => <LiveChatSkeleton />,
};
