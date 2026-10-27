import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['motion'],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Shapes: Story = {
  render: (args) => (
    <div className="tw:flex tw:items-end tw:gap-stack tw:text-caption tw:text-fg-muted">
      <figure className="tw:m-0 tw:flex tw:flex-col tw:gap-inline">
        <Skeleton {...args} className="tw:aspect-video tw:w-48" />
        <figcaption>rect</figcaption>
      </figure>
      <figure className="tw:m-0 tw:flex tw:flex-col tw:gap-inline">
        <Skeleton {...args} shape="circle" className="tw:size-avatar-lg" />
        <figcaption>circle</figcaption>
      </figure>
      <figure className="tw:m-0 tw:flex tw:w-48 tw:flex-col tw:gap-inline">
        <div className="tw:flex tw:flex-col tw:gap-inline tw:text-body">
          <Skeleton {...args} shape="text" />
          <Skeleton {...args} shape="text" className="tw:w-2/3" />
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
      className="tw:grid tw:max-w-[48rem] tw:grid-cols-2 tw:gap-grid-x tw:text-fg"
    >
      <h2 id="loading-heading" className="tw:col-span-2 tw:m-0 tw:text-title">
        Loading the shelf
      </h2>
      <div className="tw:flex tw:flex-col tw:gap-inline">
        <Skeleton {...args} className="tw:aspect-video tw:w-full" />
        <div className="tw:flex tw:gap-inline">
          <Skeleton {...args} shape="circle" className="tw:size-avatar-md" />
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1 tw:text-body-sm">
            <Skeleton {...args} shape="text" className="tw:w-11/12" />
            <Skeleton {...args} shape="text" className="tw:w-1/2" />
          </div>
        </div>
      </div>
      <div className="tw:flex tw:gap-inline">
        <Skeleton {...args} shape="circle" className="tw:size-avatar-sm" />
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1 tw:text-body">
          <Skeleton {...args} shape="text" className="tw:w-1/3" />
          <Skeleton {...args} shape="text" />
          <Skeleton {...args} shape="text" className="tw:w-3/4" />
        </div>
      </div>
    </section>
  ),
};
