import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoCard } from '@vp/components';
import { Button, Icon } from '@vp/ui';
import { ChannelSpotlight, ChannelSpotlightSkeleton } from '..';
import { ChannelSpotlightRoot, type ChannelSpotlightRootProps } from '../channel-spotlight';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="darkgoldenrod"/><stop offset="1" stop-color="midnightblue"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000031';

interface StorySpotlightProps extends ChannelSpotlightRootProps {
  kicker?: string;
  title?: string;
}

function StorySpotlight({
  kicker = 'Channel trailer',
  title = 'Marta Reis Films in two minutes',
  ...props
}: StorySpotlightProps) {
  return (
    <ChannelSpotlight.Root {...props}>
      <VideoCard.Root variant="spotlight" videoId={VIDEO_ID}>
        <VideoCard.Thumb src={POSTER} alt="" duration="2:04" />
        <ChannelSpotlight.Kicker>{kicker}</ChannelSpotlight.Kicker>
        <VideoCard.Title asChild>
          <a href={`/watch/${VIDEO_ID}`}>{title}</a>
        </VideoCard.Title>
        <VideoCard.Meta>86K views</VideoCard.Meta>
        <ChannelSpotlight.Actions>
          <Button tone="accent" variant="solid">
            <Icon name="play" />
            Watch
          </Button>
        </ChannelSpotlight.Actions>
      </VideoCard.Root>
    </ChannelSpotlight.Root>
  );
}

const meta = {
  title: 'Web/ChannelSpotlight',
  component: ChannelSpotlightRoot,
  args: { source: 'trailer' },
} satisfies Meta<typeof ChannelSpotlightRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Trailer: Story = {
  render: (args) => <StorySpotlight {...args} />,
};

export const ReturningSubscriber: Story = {
  args: { source: 'returning' },
  render: (args) => <StorySpotlight {...args} kicker="Welcome back" title="Tram lines, part two" />,
};

export const LongTitle: Story = {
  render: (args) => (
    <StorySpotlight
      {...args}
      title="Shot entirely on a 1998 camcorder over eleven nights: Lisbon after the last tram, the bakeries, the harbour and the people still out"
    />
  ),
};

export const Compact: Story = {
  render: (args) => (
    <div className="max-w-[22.5rem]">
      <StorySpotlight {...args} />
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => <StorySpotlight {...args} />,
};

export const Skeleton: Story = {
  render: () => <ChannelSpotlightSkeleton />,
};
