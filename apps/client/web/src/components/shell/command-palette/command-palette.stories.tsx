import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { SectionError } from '@vp/components';
import { Avatar, Icon } from '@vp/ui';
import { CommandPalette, CommandPaletteSkeleton } from '.';
import { CommandPaletteRoot, type CommandPaletteRootProps } from './command-palette';

const FRAME =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23263238'/%3E%3Ccircle cx='11' cy='6' r='2.5' fill='%23c9a66b'/%3E%3C/svg%3E";

const meta = {
  title: 'Web/CommandPalette',
  component: CommandPaletteRoot,
  tags: ['motion'],
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: () => undefined,
    query: 'lisbon',
    onQueryChange: () => undefined,
    onSubmitQuery: () => undefined,
  },
} satisfies Meta<typeof CommandPaletteRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const select = () => undefined;

function Actions() {
  return (
    <CommandPalette.Group heading="Actions">
      <CommandPalette.Item
        value="action:theme"
        onSelect={select}
        leading={<Icon name="moon" />}
        meta="theme"
      >
        Switch to Nocturne
      </CommandPalette.Item>
      <CommandPalette.Item
        value="action:watch-later"
        onSelect={select}
        leading={<Icon name="clock" />}
        shortcut={['G', 'W']}
      >
        Open Watch later
      </CommandPalette.Item>
      <CommandPalette.Item value="action:upload" onSelect={select} leading={<Icon name="upload" />}>
        Upload a video
      </CommandPalette.Item>
    </CommandPalette.Group>
  );
}

function Results() {
  return (
    <>
      <CommandPalette.Group heading="Videos">
        <CommandPalette.Item
          value="video:camcorder"
          onSelect={select}
          leading={<img src={FRAME} alt="" />}
          meta="18:42"
        >
          Shot entirely on a 1998 camcorder: <mark>Lisbon</mark> at night
        </CommandPalette.Item>
        <CommandPalette.Item
          value="video:tram"
          onSelect={select}
          leading={<img src={FRAME} alt="" />}
          meta="6:05"
        >
          The 28 tram, end to end, <mark>Lisbon</mark>
        </CommandPalette.Item>
      </CommandPalette.Group>
      <CommandPalette.Group heading="Channels">
        <CommandPalette.Item
          value="channel:lisbon-walks"
          onSelect={select}
          leading={
            <Avatar.Root size="sm" aria-hidden="true">
              <Avatar.Fallback>LW</Avatar.Fallback>
            </Avatar.Root>
          }
          meta="41K subscribers"
        >
          <mark>Lisbon</mark> Walks
        </CommandPalette.Item>
      </CommandPalette.Group>
      <CommandPalette.Group heading="Playlists">
        <CommandPalette.Item
          value="playlist:fado"
          onSelect={select}
          leading={<Icon name="playlist" />}
          meta="12 videos"
        >
          Fado nights in <mark>Lisbon</mark>
        </CommandPalette.Item>
      </CommandPalette.Group>
    </>
  );
}

function Palette({
  args,
  above,
  children,
}: {
  args: CommandPaletteRootProps;
  above?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CommandPalette.Root {...args}>
      <CommandPalette.Input />
      {above}
      <CommandPalette.List>{children}</CommandPalette.List>
      <CommandPalette.Footer />
    </CommandPalette.Root>
  );
}

export const EmptyQuery: Story = {
  args: { query: '' },
  render: (args) => (
    <Palette args={args}>
      <CommandPalette.Group heading="Recent searches">
        <CommandPalette.Item
          value="recent:fado"
          onSelect={select}
          leading={<Icon name="history" />}
        >
          fado live
        </CommandPalette.Item>
        <CommandPalette.Item
          value="recent:tram"
          onSelect={select}
          leading={<Icon name="history" />}
        >
          lisbon tram
        </CommandPalette.Item>
      </CommandPalette.Group>
      <Actions />
    </Palette>
  ),
};

export const GroupedResults: Story = {
  render: (args) => (
    <Palette args={args}>
      <Results />
      <Actions />
    </Palette>
  ),
};

export const ActionsOnly: Story = {
  args: { query: 'switch' },
  render: (args) => (
    <Palette args={args}>
      <Actions />
    </Palette>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <Palette args={args} above={<CommandPalette.Loading />}>
      <Results />
    </Palette>
  ),
};

export const NoResults: Story = {
  args: { query: 'zzqx' },
  render: (args) => (
    <Palette args={args}>
      <CommandPalette.Empty>Nothing matches zzqx</CommandPalette.Empty>
      <Actions />
    </Palette>
  ),
};

export const Failed: Story = {
  render: (args) => (
    <Palette
      args={args}
      above={
        <CommandPalette.Notice>
          <SectionError.Root layout="bar" onRetry={() => undefined} className="tw:flex-1">
            <SectionError.Message>Suggestions did not load.</SectionError.Message>
          </SectionError.Root>
        </CommandPalette.Notice>
      }
    >
      <Actions />
    </Palette>
  ),
};

export const Offline: Story = {
  args: { query: '' },
  render: (args) => (
    <Palette args={args} above={<CommandPalette.Offline />}>
      <Actions />
    </Palette>
  ),
};

export const CompactSheet: Story = {
  args: { variant: 'sheet' },
  render: (args) => (
    <Palette args={args}>
      <Results />
      <Actions />
    </Palette>
  ),
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:max-w-[40rem]">
      <CommandPaletteSkeleton />
    </div>
  ),
};
