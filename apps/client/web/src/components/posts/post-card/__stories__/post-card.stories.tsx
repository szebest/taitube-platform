import { Button, Icon } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { PostCard } from '..';
import { PostCardRoot, type PostCardRootProps } from '../post-card';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';
const VIDEO_ID = '0190c3a0-5e1d-7000-8000-0000000e2001';

const picture = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>`
  )}`;

const IMAGES = [
  ['saddlebrown', 'sandybrown', 'A tram in the depot'],
  ['darkslateblue', 'cornflowerblue', 'A stop at night'],
  ['darkgreen', 'lightgreen', 'A park by the line'],
  ['firebrick', 'salmon', 'A sunset over the river'],
].map(([from = '', to = '', alt = '']) => ({
  alt,
  urls: { w640: picture(from, to), w1280: picture(from, to) },
}));

const frame: Decorator = (Story) => (
  <div className="max-w-[40rem] p-section">
    <Story />
  </div>
);

function StoryCard({ children, ...props }: Partial<PostCardRootProps> & { children: ReactNode }) {
  return (
    <PostCard.Root channelName="Marta Reis Films" {...props}>
      <PostCard.Header
        channelId={CHANNEL_ID}
        name="Marta Reis Films"
        time="2 days ago"
        dateTime="2026-10-14T09:12:00.000Z"
      />
      <PostCard.Body>{children}</PostCard.Body>
      <PostCard.Actions>
        <Button variant="ghost" tone="neutral" aria-pressed={false} aria-label="Like">
          <Icon name="heart" />
          12
        </Button>
        <Button variant="ghost" tone="neutral" aria-label="3 replies">
          <Icon name="chat" />3
        </Button>
      </PostCard.Actions>
    </PostCard.Root>
  );
}

const meta = {
  title: 'Web/PostCard',
  tags: ['text', 'translated'],
  component: PostCardRoot,
  args: { channelName: 'Marta Reis Films' },
  parameters: { app: {} },
  decorators: [frame],
} satisfies Meta<typeof PostCardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {
  render: () => (
    <StoryCard>
      <PostCard.Text text="New episode on Friday. The rain on tiles took three nights to get right." />
    </StoryCard>
  ),
};

export const WithLink: Story = {
  render: () => (
    <StoryCard>
      <PostCard.Text
        text={
          'Behind the scenes: https://example.com/making-of.\nNothing else here is markup <b>at all</b>.'
        }
      />
    </StoryCard>
  ),
};

export const PinnedAndEdited: Story = {
  render: () => (
    <PostCard.Root channelName="Marta Reis Films">
      <PostCard.Header
        channelId={CHANNEL_ID}
        name="Marta Reis Films"
        time="2 days ago"
        dateTime="2026-10-14T09:12:00.000Z"
      >
        <PostCard.Pinned />
        <PostCard.Edited />
      </PostCard.Header>
      <PostCard.Body>
        <PostCard.Text text="Our community guidelines, updated." />
      </PostCard.Body>
    </PostCard.Root>
  ),
};

export const OneImage: Story = {
  render: () => (
    <StoryCard>
      <PostCard.Text text="Depot day." />
      <PostCard.Media images={IMAGES.slice(0, 1)} />
    </StoryCard>
  ),
};

export const FourImages: Story = {
  render: () => (
    <StoryCard>
      <PostCard.Media images={IMAGES} />
    </StoryCard>
  ),
};

export const SharedVideoAtAMoment: Story = {
  render: () => (
    <StoryCard>
      <PostCard.Text text="Watch from 1:30, the tram arrives." />
      <PostCard.ShareCard
        startMs={90_000}
        share={{
          type: 'video',
          id: VIDEO_ID,
          title: 'Lisbon at night',
          thumbnailUrl: picture('midnightblue', 'slateblue'),
          durationSeconds: 754,
        }}
      />
    </StoryCard>
  ),
};

export const SharedPlaylist: Story = {
  render: () => (
    <StoryCard>
      <PostCard.ShareCard
        share={{ type: 'playlist', id: VIDEO_ID, title: 'Night trams', itemCount: 12 }}
      />
    </StoryCard>
  ),
};

export const SharedVideoUnavailable: Story = {
  render: () => (
    <StoryCard>
      <PostCard.ShareCard share={{ type: 'unavailable' }} />
    </StoryCard>
  ),
};
