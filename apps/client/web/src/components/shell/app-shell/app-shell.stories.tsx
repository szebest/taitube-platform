import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip } from '@vp/ui';
import type { ReactNode } from 'react';
import { NowPlayingBar } from '../now-playing-bar';
import { AppShell, AppShellSkeleton } from '.';
import { AppShellRoot, type AppShellRootProps } from './app-shell';

const FRAME =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23263238'/%3E%3Ccircle cx='11' cy='6' r='2.5' fill='%23c9a66b'/%3E%3C/svg%3E";

const withTooltips: Decorator = (Story) => (
  <Tooltip.Provider>
    <Story />
  </Tooltip.Provider>
);

const meta = {
  title: 'Web/AppShell',
  component: AppShellRoot,
  parameters: { layout: 'fullscreen' },
  decorators: [withTooltips],
  args: { railState: 'open', onRailStateChange: () => undefined },
} satisfies Meta<typeof AppShellRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

function Shell({
  args,
  nowPlaying,
  channelName = 'Your channel',
}: {
  args: AppShellRootProps;
  nowPlaying?: ReactNode;
  channelName?: string;
}) {
  return (
    <AppShell.Root {...args}>
      <AppShell.Header
        logo={<a href="/">Taitube</a>}
        search={<AppShell.SearchTrigger>Search</AppShell.SearchTrigger>}
      />
      <AppShell.Rail>
        <AppShell.Group>
          <AppShell.Item icon="home" href="/" active>
            <AppShell.Label>Home</AppShell.Label>
          </AppShell.Item>
          <AppShell.Item icon="shorts" href="/shorts">
            <AppShell.Label>Shorts</AppShell.Label>
          </AppShell.Item>
          <AppShell.Item icon="following" href="/subscriptions">
            <AppShell.Label>Subscriptions</AppShell.Label>
          </AppShell.Item>
          <AppShell.Item icon="flame" href="/feed/trending">
            <AppShell.Label>Trending</AppShell.Label>
          </AppShell.Item>
          <AppShell.Item icon="live" href="/live" labelled>
            <AppShell.Label>Live</AppShell.Label>
          </AppShell.Item>
        </AppShell.Group>
        <AppShell.Group heading="You">
          <AppShell.Item icon="you" href="/channel">
            <AppShell.Label>{channelName}</AppShell.Label>
          </AppShell.Item>
          <AppShell.Item icon="video" href="/studio" labelled>
            <AppShell.Label>Your videos</AppShell.Label>
          </AppShell.Item>
        </AppShell.Group>
      </AppShell.Rail>
      <AppShell.Main>
        <p>Page content</p>
      </AppShell.Main>
      {nowPlaying && <AppShell.NowPlaying>{nowPlaying}</AppShell.NowPlaying>}
      <AppShell.TabBar>
        <AppShell.TabItem icon="home" href="/" active>
          Home
        </AppShell.TabItem>
        <AppShell.TabItem icon="shorts" href="/shorts">
          Shorts
        </AppShell.TabItem>
        <AppShell.TabItem icon="flame" href="/feed/trending">
          Trending
        </AppShell.TabItem>
      </AppShell.TabBar>
    </AppShell.Root>
  );
}

export const Loaded: Story = { render: (args) => <Shell args={args} /> };

export const Collapsed: Story = {
  args: { railState: 'collapsed' },
  render: (args) => <Shell args={args} />,
};

export const WithNowPlaying: Story = {
  render: (args) => (
    <Shell
      args={args}
      nowPlaying={
        <NowPlayingBar.Root
          playing
          progress={0.22}
          onPlayPause={() => undefined}
          onSeek={() => undefined}
        >
          <NowPlayingBar.Media>
            <img src={FRAME} alt="" />
          </NowPlayingBar.Media>
          <NowPlayingBar.Info>
            <NowPlayingBar.Title>
              Shot entirely on a 1998 camcorder: Lisbon at night
            </NowPlayingBar.Title>
            <NowPlayingBar.Subtitle>Marta Reis Films</NowPlayingBar.Subtitle>
          </NowPlayingBar.Info>
          <NowPlayingBar.Transport>
            <NowPlayingBar.PlayPause />
          </NowPlayingBar.Transport>
        </NowPlayingBar.Root>
      }
    />
  ),
};

export const LongChannelName: Story = {
  render: (args) => (
    <Shell args={args} channelName="Marta Reis Films: night walks, trams and fado in Lisbon" />
  ),
};

export const Immersive: Story = {
  args: { variant: 'immersive' },
  render: (args) => <Shell args={args} />,
};

export const Skeleton: Story = {
  render: () => <AppShellSkeleton />,
};
