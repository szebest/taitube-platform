import type { Meta, StoryObj } from '@storybook/react-vite';
import { NowPlayingBar, NowPlayingBarSkeleton } from '.';
import { NowPlayingBarRoot, type NowPlayingBarRootProps } from './now-playing-bar';

const FRAME =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23263238'/%3E%3Ccircle cx='11' cy='6' r='2.5' fill='%23c9a66b'/%3E%3C/svg%3E";

const meta = {
  title: 'Web/NowPlayingBar',
  component: NowPlayingBarRoot,
  args: {
    playing: true,
    progress: 0.22,
    status: 'ready',
    onPlayPause: () => undefined,
    onSeek: () => undefined,
  },
} satisfies Meta<typeof NowPlayingBarRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

interface BarContent {
  title?: string;
  queue?: string;
  last?: boolean;
}

function renderBar(
  args: NowPlayingBarRootProps,
  {
    title = 'Shot entirely on a 1998 camcorder: Lisbon at night',
    queue = '3 / 12',
    last = false,
  }: BarContent = {}
) {
  return (
    <NowPlayingBar.Root {...args}>
      <NowPlayingBar.Expand onClick={() => undefined} />
      <NowPlayingBar.Media>
        <img src={FRAME} alt="" />
      </NowPlayingBar.Media>
      <NowPlayingBar.Info>
        <NowPlayingBar.Title>{title}</NowPlayingBar.Title>
        <NowPlayingBar.Subtitle>Marta Reis Films · {queue} in queue</NowPlayingBar.Subtitle>
      </NowPlayingBar.Info>
      <NowPlayingBar.Transport>
        <NowPlayingBar.Previous />
        <NowPlayingBar.PlayPause />
        <NowPlayingBar.Next disabled={last} />
      </NowPlayingBar.Transport>
      <NowPlayingBar.Progress valueText="4 minutes 12 seconds of 18 minutes 42 seconds" />
      <NowPlayingBar.Time>04:12 / 18:42</NowPlayingBar.Time>
      <NowPlayingBar.Queue count={queue} />
    </NowPlayingBar.Root>
  );
}

export const PlayingWithQueuePosition: Story = { render: (args) => renderBar(args) };

export const Paused: Story = { args: { playing: false }, render: (args) => renderBar(args) };

export const Buffering: Story = {
  args: { status: 'buffering' },
  render: (args) => renderBar(args),
};

export const Live: Story = { args: { status: 'live' }, render: (args) => renderBar(args) };

export const LastInQueue: Story = {
  args: { progress: 0.9 },
  render: (args) => renderBar(args, { queue: '12 / 12', last: true }),
};

export const Unavailable: Story = {
  args: { status: 'unavailable', playing: false },
  render: (args) => renderBar(args),
};

export const CompactAboveTheTabBar: Story = {
  render: (args) => <div className="tw:max-w-[23.4375rem]">{renderBar(args)}</div>,
};

export const LongTitle: Story = {
  render: (args) =>
    renderBar(args, {
      title:
        'Shot entirely on a 1998 camcorder: Lisbon at night, the trams, the river and the long walk home through Alfama after the last fado house closed',
    }),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => renderBar(args),
};

export const Skeleton: Story = { render: () => <NowPlayingBarSkeleton /> };
