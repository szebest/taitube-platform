import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { PlaylistCover, PlaylistCoverSkeleton } from '..';

const poster = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="${fill}"/></svg>`
  )}`;

const IMAGES = ['#5a2a12', '#2f4a5c', '#6b5a1e', '#3d2f5c'].map(poster);

const frame: Decorator = (Story) => (
  <div className="w-[20rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/PlaylistCover',
  component: PlaylistCover,
  args: { images: IMAGES },
  decorators: [frame],
} satisfies Meta<typeof PlaylistCover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { images: [] } };

export const OneImage: Story = { args: { images: IMAGES.slice(0, 1) } };

export const TwoImages: Story = { args: { images: IMAGES.slice(0, 2) } };

export const ThreeImages: Story = { args: { images: IMAGES.slice(0, 3) } };

export const FourImages: Story = {};

export const Skeleton: Story = { render: () => <PlaylistCoverSkeleton /> };

export const RightToLeft: Story = {
  args: { images: IMAGES.slice(0, 3) },
  globals: { direction: 'rtl' },
};
