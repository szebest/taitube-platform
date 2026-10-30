import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionError } from '@vp/components';

import { Shelf } from '#app/components/discovery/shelf';
import { VideoCard, type VideoCardVariant } from '#app/components/video/video-card';
import { StartHereShelf, StartHereShelfSkeleton, type StartHereSource } from '.';
import { StartHereShelfRoot } from './start-here-shelf';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="peru"/><stop offset="1" stop-color="midnightblue"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const VIDEOS = [
  { id: '0190a1b2-0000-7000-8000-000000000011', title: 'Lisbon at night, on tape' },
  { id: '0190a1b2-0000-7000-8000-000000000012', title: 'The 28 tram, end to end' },
  { id: '0190a1b2-0000-7000-8000-000000000013', title: 'Rain on the tiles of Alfama' },
  { id: '0190a1b2-0000-7000-8000-000000000014', title: 'Harbour lights at dawn' },
  { id: '0190a1b2-0000-7000-8000-000000000015', title: 'The bakery that never closes' },
  { id: '0190a1b2-0000-7000-8000-000000000016', title: 'Sintra in the fog' },
];

const POSITIONS = ['1', '2', '3', '4', '5', '6'];

const items = (count: number, variant: VideoCardVariant = 'shelf') =>
  VIDEOS.slice(0, count).map((video, index) => (
    <StartHereShelf.Item key={video.id} position={POSITIONS[index]}>
      <VideoCard.Root variant={variant} videoId={video.id}>
        <VideoCard.Thumb src={POSTER} duration="18:42" />
        <VideoCard.Byline name="Marta Reis Films" />
        <VideoCard.Title asChild>
          <a href={`/watch/${video.id}`}>{video.title}</a>
        </VideoCard.Title>
        <VideoCard.Meta>412K views · 2 days ago</VideoCard.Meta>
      </VideoCard.Root>
    </StartHereShelf.Item>
  ));

function StoryShelf({
  source,
  count = 6,
  note = 'New here? Begin with these three.',
  variant,
}: {
  source: StartHereSource;
  count?: number;
  note?: string;
  variant?: VideoCardVariant;
}) {
  return (
    <StartHereShelf.Root source={source}>
      <StartHereShelf.Header>
        <StartHereShelf.Kicker />
        <StartHereShelf.Note>{note}</StartHereShelf.Note>
      </StartHereShelf.Header>
      <StartHereShelf.Track>{items(count, variant)}</StartHereShelf.Track>
      <StartHereShelf.Footer>
        <StartHereShelf.Attribution />
        <Shelf.Action asChild>
          <a href="#videos">See all videos</a>
        </Shelf.Action>
      </StartHereShelf.Footer>
    </StartHereShelf.Root>
  );
}

const meta = {
  title: 'Web/StartHereShelf',
  component: StartHereShelfRoot,
  args: { source: 'pinned' },
} satisfies Meta<typeof StartHereShelfRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PinnedNumberedWithNote: Story = {
  render: () => <StoryShelf source="pinned" />,
};

export const PopularFallback: Story = {
  render: () => <StoryShelf source="popular" />,
};

export const TwoItems: Story = {
  render: () => <StoryShelf source="pinned" count={2} />,
};

export const SingleItemAsSpotlight: Story = {
  render: () => <StoryShelf source="pinned" count={1} variant="spotlight" />,
};

export const LongNote: Story = {
  render: () => (
    <StoryShelf
      source="pinned"
      note="New here? Start with the tram film, then the bakery, then anything shot after midnight: that is where this channel lives, and where the tape hiss stops sounding like a fault."
    />
  ),
};

export const ErrorInTrack: Story = {
  render: () => (
    <StartHereShelf.Root source="pinned">
      <StartHereShelf.Header>
        <StartHereShelf.Kicker />
      </StartHereShelf.Header>
      <SectionError.Root onRetry={() => undefined}>
        <SectionError.Message>These videos could not be loaded.</SectionError.Message>
      </SectionError.Root>
    </StartHereShelf.Root>
  ),
};

export const CompactSwipe: Story = {
  render: () => (
    <div className="tw:max-w-[22.5rem]">
      <StoryShelf source="pinned" />
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: () => <StoryShelf source="pinned" />,
};

export const Skeleton: Story = {
  render: () => <StartHereShelfSkeleton />,
};
