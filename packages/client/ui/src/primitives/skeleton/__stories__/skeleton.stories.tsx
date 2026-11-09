import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '../skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['motion'],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Shapes: Story = {
  render: (args) => (
    <div className="flex items-end gap-stack text-caption text-fg-muted">
      <figure className="m-0 flex flex-col gap-inline">
        <Skeleton {...args} className="aspect-video w-48" />
        <figcaption>rect</figcaption>
      </figure>
      <figure className="m-0 flex flex-col gap-inline">
        <Skeleton {...args} shape="circle" className="size-avatar-lg" />
        <figcaption>circle</figcaption>
      </figure>
      <figure className="m-0 flex w-48 flex-col gap-inline">
        <div className="flex flex-col gap-inline text-body">
          <Skeleton {...args} shape="text" />
          <Skeleton {...args} shape="text" className="w-2/3" />
        </div>
        <figcaption>text</figcaption>
      </figure>
    </div>
  ),
};

export const VideoCardAndComment: Story = {
  render: (args) => (
    <section
      aria-busy="true"
      aria-labelledby="loading-heading"
      className="grid max-w-[48rem] grid-cols-2 gap-grid-x text-fg"
    >
      <h2 id="loading-heading" className="col-span-2 m-0 text-title">
        Loading the shelf
      </h2>
      <div className="flex flex-col gap-inline">
        <Skeleton {...args} className="aspect-video w-full" />
        <div className="flex gap-inline">
          <Skeleton {...args} shape="circle" className="size-avatar-md" />
          <div className="flex flex-1 flex-col gap-1 text-body-sm">
            <Skeleton {...args} shape="text" className="w-11/12" />
            <Skeleton {...args} shape="text" className="w-1/2" />
          </div>
        </div>
      </div>
      <div className="flex gap-inline">
        <Skeleton {...args} shape="circle" className="size-avatar-sm" />
        <div className="flex flex-1 flex-col gap-1 text-body">
          <Skeleton {...args} shape="text" className="w-1/3" />
          <Skeleton {...args} shape="text" />
          <Skeleton {...args} shape="text" className="w-3/4" />
        </div>
      </div>
    </section>
  ),
};
