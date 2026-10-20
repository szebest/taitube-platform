import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '../skeleton';
import { AspectRatio } from './aspect-ratio';
import type { MediaShape } from './types';

const meta = {
  title: 'Primitives/AspectRatio',
  component: AspectRatio,
} satisfies Meta<typeof AspectRatio>;

export default meta;

type Story = StoryObj<typeof meta>;

const SHAPES: readonly MediaShape[] = ['video', 'poster', 'square', 'banner'];

export const EveryShape: Story = {
  render: (args) => (
    <div className="tw:grid tw:grid-cols-4 tw:items-start tw:gap-grid-x tw:text-caption tw:text-fg-muted">
      {SHAPES.map((shape) => (
        <figure key={shape} className="tw:m-0 tw:flex tw:flex-col tw:gap-inline">
          <AspectRatio
            {...args}
            shape={shape}
            className="tw:overflow-hidden tw:rounded-thumb tw:bg-media"
          />
          <AspectRatio {...args} shape={shape}>
            <Skeleton />
          </AspectRatio>
          <figcaption>{shape}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
