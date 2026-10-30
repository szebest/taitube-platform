import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@vp/ui';
import { VideoThumbnail, VideoThumbnailSkeleton } from '.';
import { VideoThumbnailRoot } from './video-thumbnail';

const frame = (from: string, to: string, width = 320, height = 180) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;

const DUSK = frame('rgb(196 98 45)', 'rgb(38 28 64)');
const SNOW = frame('rgb(255 255 255)', 'rgb(236 240 244)');
const NIGHT = frame('rgb(0 0 0)', 'rgb(16 16 24)');
const TALL = frame('rgb(60 120 110)', 'rgb(20 30 60)', 180, 320);

const meta = {
  title: 'Components/VideoThumbnail',
  component: VideoThumbnailRoot,
  args: { videoId: '0190a1b2-0000-7000-8000-000000000001', className: 'tw:w-80 tw:max-w-full' },
} satisfies Meta<typeof VideoThumbnailRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Landscape: Story = {
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image src={DUSK} />
      <VideoThumbnail.Duration spoken="18 minutes 42 seconds">18:42</VideoThumbnail.Duration>
      <VideoThumbnail.Progress value={0.62} />
    </VideoThumbnail.Root>
  ),
};

export const WithBadges: Story = {
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image src={DUSK} />
      <VideoThumbnail.Badge>
        <Badge variant="scrim">4K</Badge>
        <Badge variant="solid" tone="accent">
          New
        </Badge>
      </VideoThumbnail.Badge>
      <VideoThumbnail.Duration>18:42</VideoThumbnail.Duration>
    </VideoThumbnail.Root>
  ),
};

export const Live: Story = {
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image src={NIGHT} />
      <VideoThumbnail.Live />
      <VideoThumbnail.Duration>18:42</VideoThumbnail.Duration>
      <VideoThumbnail.Progress value={0.4} />
    </VideoThumbnail.Root>
  ),
};

export const NoImage: Story = {
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image />
      <VideoThumbnail.Badge>
        <Badge variant="scrim">Processing</Badge>
      </VideoThumbnail.Badge>
    </VideoThumbnail.Root>
  ),
};

export const Portrait: Story = {
  args: { aspect: 'poster', className: 'tw:w-44' },
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image src={TALL} />
      <VideoThumbnail.Duration>0:48</VideoThumbnail.Duration>
    </VideoThumbnail.Root>
  ),
};

export const LongDuration: Story = {
  render: (args) => (
    <VideoThumbnail.Root {...args}>
      <VideoThumbnail.Image src={DUSK} />
      <VideoThumbnail.Duration spoken="3 hours 42 minutes 10 seconds">
        3:42:10
      </VideoThumbnail.Duration>
    </VideoThumbnail.Root>
  ),
};

export const ChipContrast: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {[SNOW, NIGHT].map((src) => (
        <VideoThumbnail.Root key={src} {...args}>
          <VideoThumbnail.Image src={src} />
          <VideoThumbnail.Badge>
            <Badge variant="scrim">4K</Badge>
          </VideoThumbnail.Badge>
          <VideoThumbnail.Duration>12:05</VideoThumbnail.Duration>
          <VideoThumbnail.Progress value={0.3} />
        </VideoThumbnail.Root>
      ))}
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: WithBadges.render,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:gap-stack">
      <VideoThumbnailSkeleton />
      <VideoThumbnailSkeleton aspect="poster" className="tw:w-24" />
    </div>
  ),
};
