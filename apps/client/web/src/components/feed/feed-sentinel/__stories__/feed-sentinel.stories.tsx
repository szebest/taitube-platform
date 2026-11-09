import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FeedSentinel } from '..';

function Feed({ rowsHeight }: { rowsHeight: string }) {
  const [requests, setRequests] = useState(0);

  return (
    <div className="p-section">
      <p className="m-0 text-body text-fg">Pages requested: {requests}</p>
      <div
        className="my-stack rounded-card border border-dashed border-fg-muted"
        style={{ height: rowsHeight }}
      />
      <FeedSentinel onNear={() => setRequests((count) => count + 1)} />
    </div>
  );
}

const meta = {
  title: 'Web/FeedSentinel',
  component: FeedSentinel,
  args: { onNear: () => undefined },
} satisfies Meta<typeof FeedSentinel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NearTheEnd: Story = {
  render: () => <Feed rowsHeight="8rem" />,
  play: async ({ canvas }) => {
    await canvas.findByText('Pages requested: 1');
  },
};

export const FarBelowTheFold: Story = {
  render: () => <Feed rowsHeight="3000px" />,
};

export const ScrolledToTheEnd: Story = {
  render: () => <Feed rowsHeight="3000px" />,
  play: async ({ canvas, canvasElement }) => {
    canvasElement.ownerDocument.defaultView?.scrollTo({ top: 3000 });
    await canvas.findByText('Pages requested: 1');
  },
};
