import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell, AppShellSkeleton } from '.';
import { AppShellRoot } from './app-shell';

const meta = {
  title: 'Web/AppShell',
  component: AppShellRoot,
  parameters: { layout: 'fullscreen' },
  args: { railState: 'open', onRailStateChange: () => undefined },
} satisfies Meta<typeof AppShellRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: (args) => (
    <AppShell.Root {...args}>
      <AppShell.Header
        logo={<a href="/">Taitube</a>}
        search={<input aria-label="Search" placeholder="Search" />}
      />
      <AppShell.Rail>
        <AppShell.Group>
          <AppShell.Item icon="home" href="/" active>
            Home
          </AppShell.Item>
          <AppShell.Item icon="flame" href="/feed/trending">
            Trending
          </AppShell.Item>
          <AppShell.Item icon="following" href="/subscriptions">
            Subscriptions
          </AppShell.Item>
        </AppShell.Group>
        <AppShell.Group heading="You">
          <AppShell.Item icon="you" href="/channel">
            Your channel
          </AppShell.Item>
          <AppShell.Item icon="video" href="/studio" labelled>
            Your videos
          </AppShell.Item>
        </AppShell.Group>
      </AppShell.Rail>
      <AppShell.Main>
        <p>Page content</p>
      </AppShell.Main>
      <AppShell.TabBar>
        <AppShell.TabItem icon="home" href="/" active>
          Home
        </AppShell.TabItem>
        <AppShell.TabItem icon="flame" href="/feed/trending">
          Trending
        </AppShell.TabItem>
      </AppShell.TabBar>
    </AppShell.Root>
  ),
};

export const Collapsed: Story = {
  args: { railState: 'collapsed' },
  render: Loaded.render,
};

export const Skeleton: Story = {
  render: () => <AppShellSkeleton />,
};
