import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { VideoSummary } from '@vp/api-contracts';
import { VideoGrid, VideoGridSkeleton } from '..';

const TINTS = [
  ['rgb(196 98 45)', 'rgb(38 28 64)'],
  ['rgb(60 120 110)', 'rgb(20 30 60)'],
  ['rgb(120 80 160)', 'rgb(30 20 50)'],
  ['rgb(180 150 70)', 'rgb(60 40 30)'],
] as const;

const frame = (index: number) => {
  const [from, to] = TINTS[index % TINTS.length] ?? TINTS[0];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;
};

const CHANNELS = ['Marta Reis Films', 'Night Tram Society', 'Rui Matos', 'Ines Carvalho'];

const videos = (count: number): VideoSummary[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `0190c3a0-5e1d-7000-8000-${String(index + 1).padStart(12, '0')}`,
    ownerId: '0190c3a0-5e1d-7000-8000-00000000b001',
    title: `Lisbon at night, part ${index + 1}`,
    description: null,
    visibility: 'public',
    status: 'READY',
    format: 'standard',
    durationMs: (index + 4) * 61_000,
    thumbnailUrl: frame(index),
    channel: {
      id: `0190c3a0-5e1d-7000-8000-00000000c00${index % CHANNELS.length}`,
      handle: `channel${index % CHANNELS.length}`,
      displayName: CHANNELS[index % CHANNELS.length] ?? 'Channel',
      avatarUrl: null,
    },
    viewsCount: 1200 * (index + 1),
    version: 0,
    createdAt: '2026-10-14T09:12:00.000Z',
    updatedAt: '2026-10-14T09:12:00.000Z',
  }));

const padded: Decorator = (Story) => (
  <div className="p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/VideoGrid',
  tags: ['text', 'translated'],
  component: VideoGrid,
  args: { videos: videos(8) },
  parameters: { app: {}, layout: 'fullscreen' },
  decorators: [padded],
} satisfies Meta<typeof VideoGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const PartialLastRow: Story = {
  args: { videos: videos(5) },
};

export const SingleVideo: Story = {
  args: { videos: videos(1) },
};

export const Empty: Story = {
  args: { videos: [] },
};

export const LongList: Story = {
  args: { videos: videos(120) },
};

export const Phone: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

export const Loading: Story = {
  render: () => <VideoGridSkeleton />,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};
