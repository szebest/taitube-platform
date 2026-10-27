import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { Icon } from '@vp/ui';
import { ShortsPlayerFrame, ShortsPlayerFrameSkeleton } from '.';
import { ShortsPlayerFrameRoot, type ShortsPlayerFrameRootProps } from './shorts-player-frame';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 16"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="9" height="16" fill="url(#g)"/></svg>'
)}`;

const noop = () => undefined;

const PLAYING = { paused: false, muted: false, onTogglePlay: noop, onToggleMute: noop };

function Short({ liked = false, ...args }: ShortsPlayerFrameRootProps & { liked?: boolean }) {
  return (
    <ShortsPlayerFrame.Root {...args}>
      <ShortsPlayerFrame.Player>
        <img src={POSTER} alt="" />
        <ShortsPlayerFrame.Error onRetry={noop}>This Short did not load.</ShortsPlayerFrame.Error>
        <ShortsPlayerFrame.Caption>
          <p className="tw:m-0 tw:text-label">Marta Reis Films</p>
          <p className="tw:m-0 tw:text-body-sm">The 28 tram at dusk, one take</p>
        </ShortsPlayerFrame.Caption>
        <ShortsPlayerFrame.Progress value={0.4} />
      </ShortsPlayerFrame.Player>
      <ShortsPlayerFrame.Actions>
        <ShortsPlayerFrame.Action
          icon={<Icon name="like" />}
          count="24K"
          pressed={liked}
          onSelect={noop}
        >
          Like
        </ShortsPlayerFrame.Action>
        <ShortsPlayerFrame.Action icon={<Icon name="chat" />} count="312" onSelect={noop}>
          Discussion
        </ShortsPlayerFrame.Action>
        <ShortsPlayerFrame.Action icon={<Icon name="share" />} onSelect={noop}>
          Share
        </ShortsPlayerFrame.Action>
        <ShortsPlayerFrame.Action icon={<Icon name="queue-add" />} onSelect={noop}>
          Queue
        </ShortsPlayerFrame.Action>
      </ShortsPlayerFrame.Actions>
    </ShortsPlayerFrame.Root>
  );
}

const padded: Decorator = (Story) => (
  <div className="tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ShortsPlayerFrame',
  component: ShortsPlayerFrameRoot,
  args: { playback: PLAYING, onPrevious: noop, onNext: noop },
  decorators: [padded],
} satisfies Meta<typeof ShortsPlayerFrameRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadyWithSideActions: Story = {
  render: (args) => <Short {...args} />,
};

export const OverlayAtCompact: Story = {
  args: { layout: 'overlay' },
  globals: { viewport: { value: 'mobile1' } },
  render: (args) => <Short {...args} />,
};

export const PausedAndMuted: Story = {
  args: { playback: { ...PLAYING, paused: true, muted: true } },
  render: (args) => <Short {...args} />,
};

export const Liked: Story = {
  render: (args) => <Short {...args} liked />,
};

export const Loading: Story = {
  args: { state: 'loading' },
  render: (args) => <Short {...args} />,
};

export const Failed: Story = {
  args: { state: 'error' },
  render: (args) => <Short {...args} />,
};

export const Empty: Story = {
  args: { state: 'empty', playback: undefined, onPrevious: undefined, onNext: undefined },
  render: (args) => (
    <ShortsPlayerFrame.Root {...args}>
      <ShortsPlayerFrame.Player>
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title asChild>
            <h2>Shorts will appear here</h2>
          </EmptyState.Title>
        </EmptyState.Root>
      </ShortsPlayerFrame.Player>
    </ShortsPlayerFrame.Root>
  ),
};

export const LastShort: Story = {
  args: { state: 'ended' },
  render: (args) => <Short {...args} />,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => <Short {...args} />,
};

export const Skeleton: Story = {
  render: () => <ShortsPlayerFrameSkeleton />,
};
