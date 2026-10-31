import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoCard } from '@vp/components';
import { Badge, Button, Icon, IconButton } from '@vp/ui';
import { PickOfTheDay, PickOfTheDaySkeleton } from '.';
import { PickOfTheDayRoot, type PickOfTheDayRootProps } from './pick-of-the-day';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="darkgoldenrod"/><stop offset="1" stop-color="midnightblue"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000021';

interface StoryPickProps extends PickOfTheDayRootProps {
  title?: string;
  note?: string;
  window?: string;
}

function StoryPick({
  title = 'Shot entirely on a 1998 camcorder: Lisbon at night',
  note = 'Eighteen minutes of trams and wet tiles.',
  window = 'Picked today, 14 h left',
  ...props
}: StoryPickProps) {
  return (
    <PickOfTheDay.Root {...props}>
      <VideoCard.Root variant="spotlight" videoId={VIDEO_ID}>
        <VideoCard.Thumb src={POSTER} alt="" duration="18:42">
          <Badge variant="scrim">4K</Badge>
        </VideoCard.Thumb>
        <PickOfTheDay.Kicker />
        <VideoCard.Title asChild>
          <a href={`/watch/${VIDEO_ID}`}>{title}</a>
        </VideoCard.Title>
        {note !== '' && <PickOfTheDay.Note>{note}</PickOfTheDay.Note>}
        {window !== '' && <PickOfTheDay.Window>{window}</PickOfTheDay.Window>}
        <VideoCard.Byline name="Marta Reis Films" />
        <VideoCard.Meta>412K views</VideoCard.Meta>
        <PickOfTheDay.Actions>
          <Button tone="accent" variant="solid">
            <Icon name="play" />
            Watch
          </Button>
          <Button variant="outline">
            <Icon name="queue-add" />
            Queue
          </Button>
          <IconButton aria-label="Save">
            <Icon name="save" />
          </IconButton>
        </PickOfTheDay.Actions>
      </VideoCard.Root>
    </PickOfTheDay.Root>
  );
}

const meta = {
  title: 'Web/PickOfTheDay',
  component: PickOfTheDayRoot,
  args: { glowColor: 'darkgoldenrod' },
} satisfies Meta<typeof PickOfTheDayRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoteAndWindow: Story = {
  render: (args) => <StoryPick {...args} />,
};

export const PlainFallback: Story = {
  render: (args) => <StoryPick {...args} note="" window="" />,
};

export const LongTitleAndNote: Story = {
  render: (args) => (
    <StoryPick
      {...args}
      title="Shot entirely on a 1998 camcorder over eleven nights: Lisbon after the last tram, the bakeries, the harbour and the people still out"
      note="Eighteen minutes of trams and wet tiles, a city heard more than seen, and the most patient camera work on Taitube this year. Watch it with the lights off and the sound up."
    />
  ),
};

export const BrightGlow: Story = {
  args: { glowColor: 'gold' },
  render: (args) => <StoryPick {...args} />,
};

export const DarkGlow: Story = {
  args: { glowColor: 'midnightblue' },
  render: (args) => <StoryPick {...args} />,
};

export const DefaultLayout: Story = {
  args: { layout: 'default' },
  render: (args) => <StoryPick {...args} />,
};

export const StackedAtCompact: Story = {
  args: { layout: 'stacked' },
  render: (args) => (
    <div className="tw:max-w-[22.5rem]">
      <StoryPick {...args} />
    </div>
  ),
};

export const WindowUnderAnHour: Story = {
  render: (args) => <StoryPick {...args} window="Picked today, 40 min left" />,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => <StoryPick {...args} />,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PickOfTheDaySkeleton />
      <PickOfTheDaySkeleton layout="stacked" />
    </div>
  ),
};
