import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState, SectionError } from '@vp/components';
import { Avatar } from '@vp/ui';

import { VideoCard, VideoCardSkeleton } from '#app/components/video/video-card';
import { Shelf, ShelfSkeleton } from '.';
import { ShelfRoot } from './shelf';

const frame = (from: string, to: string, width = 320, height = 180) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;

const POSTER = frame('rgb(196 98 45)', 'rgb(38 28 64)');
const TALL = frame('rgb(60 120 110)', 'rgb(20 30 60)', 180, 320);

const VIDEOS = [
  {
    id: '0190a1b2-0000-7000-8000-000000000001',
    title: 'Lisbon at night',
    reason: 'Because you watched Porto',
  },
  {
    id: '0190a1b2-0000-7000-8000-000000000002',
    title: 'The 28 tram, end to end',
    reason: 'From a channel you follow',
  },
  {
    id: '0190a1b2-0000-7000-8000-000000000103',
    title: 'Fado in Alfama',
    reason: 'Viewers also watched',
  },
  {
    id: '0190a1b2-0000-7000-8000-000000000004',
    title: 'Harbour lights at dawn',
    reason: 'Similar topics',
  },
  {
    id: '0190a1b2-0000-7000-8000-000000000005',
    title: 'Sintra in the fog',
    reason: 'Trending now',
  },
  {
    id: '0190a1b2-0000-7000-8000-000000000006',
    title: 'A bakery that never closes',
    reason: 'In the same category',
  },
];

const meta = {
  title: 'Web/Shelf',
  component: ShelfRoot,
} satisfies Meta<typeof ShelfRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const Heading = () => (
  <Shelf.Header>
    <Shelf.Title>From channels you follow</Shelf.Title>
    <Shelf.Note>Picked by the night shift</Shelf.Note>
    <Shelf.Action asChild>
      <a href="/feed/subscriptions">See all</a>
    </Shelf.Action>
  </Shelf.Header>
);

const cards = (count: number) =>
  VIDEOS.slice(0, count).map((video) => (
    <Shelf.Item key={video.id}>
      <VideoCard.Root variant="shelf" videoId={video.id}>
        <VideoCard.Thumb src={POSTER} duration="18:42" />
        <VideoCard.Byline name="Marta Reis Films" />
        <VideoCard.Title asChild>
          <a href={`/watch/${video.id}`}>{video.title}</a>
        </VideoCard.Title>
        <VideoCard.Meta>412K views · 2 days ago</VideoCard.Meta>
        <VideoCard.Reason>{video.reason}</VideoCard.Reason>
      </VideoCard.Root>
    </Shelf.Item>
  ));

export const FiveCardsWithReasons: Story = {
  render: (args) => (
    <Shelf.Root {...args}>
      <Heading />
      <Shelf.Track>{cards(6)}</Shelf.Track>
    </Shelf.Root>
  ),
};

export const Posters: Story = {
  args: { variant: 'poster' },
  render: (args) => (
    <Shelf.Root {...args}>
      <Shelf.Header>
        <Shelf.Title>Shorts</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {VIDEOS.map((video) => (
          <Shelf.Item key={video.id}>
            <VideoCard.Root variant="poster" videoId={video.id}>
              <VideoCard.Thumb src={TALL} />
              <VideoCard.Title asChild>
                <a href={`/shorts/${video.id}`}>{video.title}</a>
              </VideoCard.Title>
            </VideoCard.Root>
          </Shelf.Item>
        ))}
      </Shelf.Track>
    </Shelf.Root>
  ),
};

export const ChannelTiles: Story = {
  args: { variant: 'channel' },
  render: (args) => (
    <Shelf.Root {...args}>
      <Shelf.Header>
        <Shelf.Title>Channels you follow</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {['Marta Reis Films', 'Night Trams', 'Fado House', 'Harbour Club', 'Sintra Walks'].map(
          (name) => (
            <Shelf.Item key={name}>
              <a
                href="/channel"
                className="tw:flex tw:flex-col tw:items-center tw:gap-inline tw:text-label tw:text-fg tw:no-underline tw:focus-ring"
              >
                <Avatar.Root size="xl">
                  <Avatar.Fallback aria-hidden="true">{name.charAt(0)}</Avatar.Fallback>
                </Avatar.Root>
                {name}
              </a>
            </Shelf.Item>
          )
        )}
      </Shelf.Track>
    </Shelf.Root>
  ),
};

export const FewerThanFit: Story = {
  render: (args) => (
    <Shelf.Root {...args}>
      <Heading />
      <Shelf.Track>{cards(2)}</Shelf.Track>
    </Shelf.Root>
  ),
};

export const LoadingMore: Story = {
  render: (args) => (
    <Shelf.Root {...args}>
      <Heading />
      <Shelf.Track busy>
        {cards(4)}
        <Shelf.Item>
          <VideoCardSkeleton variant="shelf" />
        </Shelf.Item>
      </Shelf.Track>
    </Shelf.Root>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Shelf.Root {...args}>
      <Heading />
      <EmptyState.Root size="inline">
        <EmptyState.Title asChild>
          <h3>Nothing new from the channels you follow</h3>
        </EmptyState.Title>
      </EmptyState.Root>
    </Shelf.Root>
  ),
};

export const Failed: Story = {
  render: (args) => (
    <Shelf.Root {...args}>
      <Heading />
      <SectionError.Root onRetry={() => undefined}>
        <SectionError.Message>This shelf could not be loaded.</SectionError.Message>
      </SectionError.Root>
    </Shelf.Root>
  ),
};

export const Compact: Story = {
  render: (args) => (
    <div className="tw:w-80">
      <Shelf.Root {...args}>
        <Heading />
        <Shelf.Track>{cards(6)}</Shelf.Track>
      </Shelf.Root>
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: FiveCardsWithReasons.render,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <ShelfSkeleton />
      <ShelfSkeleton variant="poster" />
      <ShelfSkeleton variant="channel" />
    </div>
  ),
};
