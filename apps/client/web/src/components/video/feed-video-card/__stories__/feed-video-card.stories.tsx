import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { screen } from '@testing-library/dom';
import type { VideoSummary } from '@vp/api-contracts';
import { FeedVideoCard } from '..';

const frame = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8a3d17"/></svg>'
)}`;

const CHANNEL = {
  id: '0190c3a0-5e1d-7000-8000-00000000c001',
  handle: 'martareis',
  displayName: 'Marta Reis Films',
  avatarUrl: AVATAR,
};

const BARE: VideoSummary = {
  id: '0190c3a0-5e1d-7000-8000-00000000a001',
  ownerId: '0190c3a0-5e1d-7000-8000-00000000b001',
  title: 'Shot entirely on a 1998 camcorder: Lisbon at night',
  description: 'A night walk from Alfama down to the river, on a camcorder older than the tram.',
  visibility: 'public',
  status: 'READY',
  format: 'standard',
  thumbnailUrl: frame('rgb(196 98 45)', 'rgb(38 28 64)'),
  channel: CHANNEL,
  viewsCount: 412_000,
  version: 0,
  createdAt: '2026-10-14T09:12:00.000Z',
  updatedAt: '2026-10-14T09:12:00.000Z',
};

const VIDEO: VideoSummary = { ...BARE, durationMs: 1_122_000 };

const inColumn: Decorator = (Story) => (
  <div className="w-80 p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/FeedVideoCard',
  tags: ['text', 'translated'],
  component: FeedVideoCard,
  args: { video: VIDEO },
  parameters: { app: {} },
  decorators: [inColumn],
} satisfies Meta<typeof FeedVideoCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const PartlyWatched: Story = {
  args: {
    video: { ...VIDEO, viewer: { progressSeconds: 420, watchedAt: '2026-10-20T18:00:00.000Z' } },
  },
  parameters: { app: { session: 'signed-in' } },
};

export const WithReason: Story = {
  args: { reason: { kind: 'shared-tags' } },
};

export const Untitled: Story = {
  args: { video: { ...BARE, title: null, description: null, channel: null } },
};

export const LongTitleAndChannel: Story = {
  args: {
    video: {
      ...VIDEO,
      title:
        'A very long title that keeps on going past two lines, so the clamp has to cut it somewhere sensible without the card growing',
      channel: {
        ...CHANNEL,
        displayName: 'The Association of Independent Night Walkers of Lisbon',
      },
      durationMs: 3_764_000,
      viewsCount: 12_400_000,
    },
  },
};

export const Expanded: Story = {
  tags: ['motion'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('article'));
    await canvas.findByText(/A night walk from Alfama/, undefined, { timeout: 2000 });
  },
};

export const MenuOpenAsMember: Story = {
  tags: ['motion'],
  args: { reason: { kind: 'shared-tags' } },
  parameters: { app: { session: 'signed-in' } },
  play: async ({ canvasElement, userEvent }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="video-card-menu"] button'
    );
    if (trigger) await userEvent.click(trigger);
    await screen.findByRole('menu');
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};
