import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Shapes: Story = {
  render: (args) => (
    <div className="tw:flex tw:items-center tw:gap-stack">
      <Skeleton {...args} className="tw:aspect-video tw:w-48" />
      <Skeleton {...args} shape="circle" className="tw:size-avatar-lg" />
      <div className="tw:flex tw:w-48 tw:flex-col tw:gap-inline tw:text-body">
        <Skeleton {...args} shape="text" />
        <Skeleton {...args} shape="text" className="tw:w-2/3" />
      </div>
    </div>
  ),
};

export const VideoCardAndComment: Story = {
  render: (args) => (
    <div aria-busy="true" className="tw:grid tw:max-w-3xl tw:grid-cols-2 tw:gap-grid-x">
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
    </div>
  ),
};
