import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, variantNames } from '@vp/ui';
import { VideoCard, VideoCardSkeleton, videoCardStyles } from '.';
import { VideoCardRoot } from './video-card';
import type { VideoCardVariant } from './types';

const frame = (from: string, to: string, width = 320, height = 180) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;

const POSTER = frame('rgb(196 98 45)', 'rgb(38 28 64)');
const TALL = frame('rgb(60 120 110)', 'rgb(20 30 60)', 180, 320);
const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000001';
const noop = () => undefined;

const WIDTHS = {
  grid: 'tw:w-80',
  shelf: 'tw:w-72',
  row: 'tw:w-120',
  poster: 'tw:w-44',
  spotlight: 'tw:w-160',
} satisfies Record<VideoCardVariant, string>;

const meta = {
  title: 'Web/VideoCard',
  component: VideoCardRoot,
  args: { videoId: VIDEO_ID, variant: 'shelf' },
} satisfies Meta<typeof VideoCardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const Card = ({
  title = 'Shot entirely on a 1998 camcorder: Lisbon at night',
  channel = 'Marta Reis Films',
  duration = '18:42',
  ...args
}: Story['args'] & { title?: string; channel?: string; duration?: string }) => (
  <VideoCard.Root {...args} className={WIDTHS[args?.variant ?? 'grid']}>
    <VideoCard.Thumb
      src={args?.variant === 'poster' ? TALL : POSTER}
      duration={duration}
      progress={0.62}
    />
    <VideoCard.Byline name={channel} />
    <VideoCard.Title asChild>
      <a href={`/watch/${VIDEO_ID}`}>{title}</a>
    </VideoCard.Title>
    <VideoCard.Meta>412K views · 2 days ago</VideoCard.Meta>
    <VideoCard.Reason>Because you watched Porto</VideoCard.Reason>
    <VideoCard.Menu onSave={noop} onQueue={noop} />
    <VideoCard.Expanded onSave={noop} onQueue={noop}>
      A night walk from Alfama down to the river, on a camcorder older than the tram it follows.
    </VideoCard.Expanded>
  </VideoCard.Root>
);

export const EveryVariant: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-section">
      {variantNames(videoCardStyles.variants.variant).map((variant) => (
        <Card key={variant} {...args} variant={variant} />
      ))}
    </div>
  ),
};

export const RowSmall: Story = {
  args: { variant: 'row', size: 'sm' },
  render: (args) => <Card {...args} />,
};

export const Live: Story = {
  args: { state: 'live' },
  render: (args) => <Card {...args} />,
};

export const Premiere: Story = {
  args: { state: 'premiere' },
  render: (args) => (
    <VideoCard.Root {...args} className="tw:w-72">
      <VideoCard.Thumb src={POSTER} duration="Fri 20:00">
        <Badge variant="solid" tone="accent">
          Premiere
        </Badge>
      </VideoCard.Thumb>
      <VideoCard.Title asChild>
        <a href={`/watch/${VIDEO_ID}`}>The tram at dawn</a>
      </VideoCard.Title>
      <VideoCard.Meta>1.2K waiting</VideoCard.Meta>
    </VideoCard.Root>
  ),
};

export const Unavailable: Story = {
  args: { state: 'unavailable' },
  render: (args) => <Card {...args} />,
};

export const LongTitleAndChannel: Story = {
  render: (args) => (
    <Card
      {...args}
      title="A very long title that keeps on going past two lines, so the clamp has to cut it somewhere sensible without the card growing"
      channel="The Association of Independent Night Walkers of Lisbon"
      duration="1:02:44"
    />
  ),
};

export const Expanded: Story = {
  render: (args) => <Card {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('article'));
    await canvas.findByText(/A night walk from Alfama/, undefined, { timeout: 2000 });
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: EveryVariant.render,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-section">
      {variantNames(videoCardStyles.variants.variant).map((variant) => (
        <div key={variant} className={WIDTHS[variant]}>
          <VideoCardSkeleton variant={variant} />
        </div>
      ))}
    </div>
  ),
};
