import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '../../skeleton';
import { AspectRatio } from '../aspect-ratio';
import type { MediaShape } from '../types';

const meta = {
  title: 'Primitives/AspectRatio',
  component: AspectRatio,
} satisfies Meta<typeof AspectRatio>;

export default meta;

type Story = StoryObj<typeof meta>;

const SHAPES: readonly MediaShape[] = ['video', 'poster', 'square', 'banner'];

export const EveryShape: Story = {
  render: (args) => (
    <div className="grid grid-cols-4 items-start gap-grid-x text-caption text-fg-muted">
      {SHAPES.map((shape) => (
        <figure key={shape} className="m-0 flex flex-col gap-inline">
          <AspectRatio {...args} shape={shape} className="overflow-hidden rounded-thumb bg-media" />
          <AspectRatio {...args} shape={shape}>
            <Skeleton />
          </AspectRatio>
          <figcaption>{shape}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
