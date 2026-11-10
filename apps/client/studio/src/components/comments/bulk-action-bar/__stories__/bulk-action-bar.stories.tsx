import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { BulkActionBar } from '../index';

const meta = {
  title: 'Studio/BulkActionBar',
  component: BulkActionBar.Root,
} satisfies Meta<typeof BulkActionBar.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

function Actions({ pending }: { pending: boolean }) {
  const [disclosure, setDisclosure] = useState<'silent' | 'visible'>('silent');

  return (
    <BulkActionBar.Root aria-label="Moderate the selected comments" pending={pending}>
      <BulkActionBar.Action>Approve</BulkActionBar.Action>
      <BulkActionBar.Action>Hide</BulkActionBar.Action>
      <BulkActionBar.Action tone="danger">Remove</BulkActionBar.Action>
      <BulkActionBar.Action tone="danger">Shadow ban</BulkActionBar.Action>
      <BulkActionBar.Action tone="danger">Ban</BulkActionBar.Action>
      <BulkActionBar.Disclosure value={disclosure} onValueChange={setDisclosure} />
    </BulkActionBar.Root>
  );
}

export const Idle: Story = { render: () => <Actions pending={false} /> };

export const Pending: Story = { render: () => <Actions pending /> };
