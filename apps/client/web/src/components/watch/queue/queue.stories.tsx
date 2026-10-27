import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useState } from 'react';
import { VideoCard } from '#app/components/video/video-card';
import { Queue, QueueSkeleton } from '.';
import { QueueRoot } from './queue';
import type { QueueModesState } from './queue';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#5a2a12"/></svg>'
)}`;

const TITLES = [
  'Lisbon trams, no music',
  'Shot entirely on a 1998 camcorder',
  'Alfama at 5 a.m.',
  'The 28 at night',
  'Rain on the Tagus',
  'Fado through a window',
  'Belém before the crowds',
  'Graça viewpoint, blue hour',
  'Market morning in Ribeira',
  'Ferry to Cacilhas',
  'Bairro Alto closing time',
  'The last tram home',
];

const VIDEOS = TITLES.map((title, index) => ({ id: `video-${index + 1}`, title }));

const noop = () => undefined;

const Row = ({ id, title, reason }: { id: string; title: string; reason?: string }) => (
  <VideoCard.Root variant="row" size="sm" videoId={id}>
    <VideoCard.Thumb src={POSTER} duration="18:42" />
    <VideoCard.Title asChild>
      <a href={`/watch/${id}`}>{title}</a>
    </VideoCard.Title>
    <VideoCard.Meta>Marta Reis Films</VideoCard.Meta>
    {reason && <VideoCard.Reason>{reason}</VideoCard.Reason>}
  </VideoCard.Root>
);

function LiveQueue({
  count = 12,
  current = 'video-3',
  args,
  recommendations = 'loaded',
}: {
  count?: number;
  current?: string;
  args: Partial<Parameters<typeof QueueRoot>[0]>;
  recommendations?: 'loaded' | 'loading';
}) {
  const [videos, setVideos] = useState(VIDEOS.slice(0, count));
  const [modes, setModes] = useState<QueueModesState>({
    shuffle: false,
    repeat: 'off',
    autoplay: true,
  });
  const position = videos.findIndex((video) => video.id === current) + 1;

  return (
    <Queue.Root
      {...args}
      currentId={current}
      onSelect={noop}
      onRemove={(id) => setVideos(videos.filter((video) => video.id !== id))}
      onReorder={(id, toIndex) => {
        const rest = videos.filter((video) => video.id !== id);
        const picked = videos.find((video) => video.id === id);
        if (picked) setVideos([...rest.slice(0, toIndex), picked, ...rest.slice(toIndex)]);
      }}
    >
      <Queue.Header
        position={`${position} / ${videos.length}`}
        modes={<Queue.Modes {...modes} onChange={setModes} />}
      >
        Your queue
      </Queue.Header>
      <Queue.List items={videos.map((video) => video.id)}>
        {videos.map((video) => (
          <Queue.Item key={video.id} id={video.id} title={video.title}>
            <Row {...video} />
          </Queue.Item>
        ))}
      </Queue.List>
      <Queue.Recommendations heading="More like this" loading={recommendations === 'loading'}>
        <Row id="rec-1" title="Porto by night bus" reason="Recommended" />
        <Row id="rec-2" title="Sintra in the fog" reason="Recommended" />
      </Queue.Recommendations>
    </Queue.Root>
  );
}

const frame: Decorator = (Story) => (
  <div className="tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/Queue',
  component: QueueRoot,
  args: { layout: 'side', currentId: 'video-3', onReorder: noop, onRemove: noop, onSelect: noop },
  decorators: [frame],
} satisfies Meta<typeof QueueRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CurrentAlone: Story = {
  render: (args) => <LiveQueue args={args} count={1} current="video-1" />,
};

export const TwelveItems: Story = {
  render: (args) => <LiveQueue args={args} current="video-6" />,
};

export const KeyboardReorder: Story = {
  render: (args) => <LiveQueue args={args} count={4} current="video-1" />,
  play: async ({ canvas, userEvent }) => {
    canvas.getByRole('button', { name: 'Reorder Alfama at 5 a.m.' }).focus();
    await userEvent.keyboard('[Space]');
    await userEvent.keyboard('[ArrowUp]');
    await userEvent.keyboard('[Space]');
  },
};

export const Modes: Story = {
  render: (args) => (
    <Queue.Root {...args}>
      <Queue.Header
        position="3 / 12"
        modes={<Queue.Modes shuffle repeat="one" autoplay onChange={noop} />}
      >
        Your queue
      </Queue.Header>
    </Queue.Root>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Queue.Root {...args}>
      <Queue.Header>Your queue</Queue.Header>
      <EmptyState.Root size="inline">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>Nothing queued</EmptyState.Title>
        <EmptyState.Action asChild>
          <a href="/">Browse</a>
        </EmptyState.Action>
      </EmptyState.Root>
    </Queue.Root>
  ),
};

export const RecommendationsLoading: Story = {
  render: (args) => <LiveQueue args={args} count={3} recommendations="loading" />,
};

export const Below: Story = {
  args: { layout: 'below' },
  render: (args) => <LiveQueue args={args} count={4} />,
};

export const CompactSheet: Story = {
  args: { layout: 'sheet' },
  globals: { viewport: { value: 'mobile1' } },
  render: (args) => <LiveQueue args={args} count={4} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Queue' }));
  },
};

export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  render: (args) => <LiveQueue args={args} count={4} />,
};

export const Skeleton: Story = {
  render: () => <QueueSkeleton layout="side" />,
};
