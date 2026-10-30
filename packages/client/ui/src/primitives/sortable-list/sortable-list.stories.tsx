import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Chip } from '../chip';
import { SortableList } from '.';
import { SortableListRoot } from './sortable-list';

const meta = {
  title: 'Primitives/SortableList',
  component: SortableListRoot,
} satisfies Meta<typeof SortableListRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const VIDEOS = ['Lisbon at night', 'Harbour at dawn', 'Tram 28, end to end', 'The making of'];

const ARGS = { items: VIDEOS, onReorder: () => undefined };

const Queue = ({ orientation }: { orientation: 'vertical' | 'horizontal' }) => {
  const [order, setOrder] = useState<readonly string[]>(VIDEOS);

  return (
    <SortableList.Root
      items={order}
      onReorder={setOrder}
      orientation={orientation}
      aria-label="Queue"
      className="tw:m-section tw:max-w-[28rem]"
    >
      {order.map((title) => (
        <SortableList.Item key={title} id={title} aria-label={title}>
          <SortableList.Handle />
          {orientation === 'horizontal' ? <Chip>{title}</Chip> : title}
        </SortableList.Item>
      ))}
    </SortableList.Root>
  );
};

export const Vertical: Story = { args: ARGS, render: () => <Queue orientation="vertical" /> };

export const Horizontal: Story = { args: ARGS, render: () => <Queue orientation="horizontal" /> };
