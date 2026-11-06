import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vp/ui';
import { ClipDetails } from '.';
import { ClipDeleteDialog } from '../clip-delete-dialog';
import { Stage } from '../stage';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#5a2a12"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const frame: Decorator = (Story) => (
  <div className="flex max-w-[56rem] flex-col gap-stack p-section">
    <Stage.Root glowColors={['#c9772f', '#8a3d17']}>
      <Stage.Glow />
      <Stage.Poster src={POSTER} alt="Lisbon trams, no music" />
    </Stage.Root>
    <Story />
  </div>
);

const meta = {
  title: 'Web/ClipDetails',
  tags: ['text'],
  component: ClipDetails,
  args: { title: 'The tram turns the corner' },
  decorators: [frame],
} satisfies Meta<typeof ClipDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

const FullVideo = (
  <Button asChild variant="solid" tone="accent">
    <a href="/watch/lisbon?t=20">Watch the full video</a>
  </Button>
);

const Delete = (
  <ClipDeleteDialog
    triggerLabel="Delete clip"
    title="Delete this clip?"
    description="Its link stops working. The video is not affected."
    confirmLabel="Delete"
    onConfirm={() => undefined}
  />
);

export const AsGuest: Story = {
  render: (args) => <ClipDetails {...args}>{FullVideo}</ClipDetails>,
};

export const AsCreator: Story = {
  render: (args) => (
    <ClipDetails {...args}>
      {FullVideo}
      {Delete}
    </ClipDetails>
  ),
};

export const LongTitle: Story = {
  args: {
    title:
      'The tram turns the corner above Alfama just as the evening light drops behind the cathedral and the whole street goes gold',
  },
  render: AsCreator.render,
};
