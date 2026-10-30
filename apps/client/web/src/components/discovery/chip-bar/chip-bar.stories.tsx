import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChipBar, ChipBarSkeleton, type ChipBarValue } from '.';
import { ChipBarRoot } from './chip-bar';

const CATEGORIES = ['All', 'Film', 'Music', 'Cooking', 'Live', 'Travel', 'Science', 'Gaming'];

const MANY = [
  ...CATEGORIES,
  'News',
  'Podcasts',
  'Animation',
  'Comedy',
  'Sport',
  'Nature',
  'History',
  'Design',
];

function Bar({
  initial,
  names = CATEGORIES,
  counts,
  disabled,
}: {
  initial: ChipBarValue;
  names?: string[];
  counts?: Record<string, string>;
  disabled?: string;
}) {
  const [value, setValue] = useState(initial);

  return (
    <ChipBar.Root aria-label="Categories" value={value} onValueChange={setValue}>
      {names.map((name) => (
        <ChipBar.Item
          key={name}
          value={name.toLowerCase()}
          count={counts?.[name]}
          disabled={name === disabled}
        >
          {name}
        </ChipBar.Item>
      ))}
    </ChipBar.Root>
  );
}

const meta = {
  title: 'Web/ChipBar',
  component: ChipBarRoot,
  args: { 'aria-label': 'Categories', value: 'all', onValueChange: () => undefined },
} satisfies Meta<typeof ChipBarRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HomeCategories: Story = {
  render: () => <Bar initial="all" />,
};

export const Overflow: Story = {
  render: () => (
    <div className="tw:max-w-[36rem]">
      <Bar initial="nature" names={MANY} />
    </div>
  ),
};

export const Multiple: Story = {
  render: () => <Bar initial={['film', 'live']} />,
};

export const WithCounts: Story = {
  render: () => (
    <Bar
      initial="videos"
      names={['Videos', 'Channels', 'Playlists', 'Shorts']}
      counts={{ Videos: '1.2K', Channels: '38', Playlists: '112', Shorts: '640' }}
    />
  ),
};

export const DisabledChip: Story = {
  render: () => <Bar initial="all" disabled="Live" />,
};

export const Sticky: Story = {
  render: () => (
    <div>
      <Bar initial="music" />
      <div className="tw:flex tw:h-[150vh] tw:flex-col tw:gap-stack tw:pt-stack tw:text-fg-muted">
        <p>Scroll the page: the bar stays under the header with a divider beneath it.</p>
      </div>
    </div>
  ),
};

export const Links: Story = {
  render: () => (
    <ChipBar.Root aria-label="Categories" value="film" onValueChange={() => undefined}>
      {CATEGORIES.map((name) => (
        <ChipBar.Item key={name} value={name.toLowerCase()} asChild>
          <a href={`?category=${name.toLowerCase()}`}>{name}</a>
        </ChipBar.Item>
      ))}
    </ChipBar.Root>
  ),
};

export const CompactTouch: Story = {
  render: () => (
    <div className="tw:max-w-[20rem]">
      <Bar initial="all" />
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: () => (
    <div className="tw:max-w-[36rem]">
      <Bar initial="film" names={MANY} />
    </div>
  ),
};

export const Skeleton: Story = {
  render: () => <ChipBarSkeleton />,
};
