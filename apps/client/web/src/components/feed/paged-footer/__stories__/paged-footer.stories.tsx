import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { waitFor } from '@testing-library/dom';
import { useState } from 'react';
import { PagedFooter, type PagedFooterProps } from '../paged-footer';

const frame: Decorator = (Story) => (
  <div className="max-w-[40rem] p-section">
    <div className="mb-stack rounded-card border border-dashed border-fg-muted p-section text-body text-fg-muted">
      The last row of the list
    </div>
    <Story />
  </div>
);

const meta = {
  title: 'Web/PagedFooter',
  tags: ['text', 'translated'],
  component: PagedFooter,
  args: { hasMore: true, isFetching: false, isError: false, onLoadMore: () => undefined },
  parameters: { app: {} },
  decorators: [frame],
} satisfies Meta<typeof PagedFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MoreToLoad: Story = {};

export const Loading: Story = {
  args: { isFetching: true },
};

export const EndOfTheList: Story = {
  args: { hasMore: false },
};

export const Failed: Story = {
  args: { isError: true },
};

export const Retrying: Story = {
  tags: ['motion'],
  args: { isError: true, isFetching: true },
};

function RetryingFooter(args: PagedFooterProps) {
  const [fetching, setFetching] = useState(false);

  return <PagedFooter {...args} isFetching={fetching} onLoadMore={() => setFetching(true)} />;
}

export const RetryAfterFailure: Story = {
  tags: ['motion'],
  args: { isError: true },
  render: (args) => <RetryingFooter {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button'));
    await waitFor(() => {
      if (canvasElement.querySelector('[aria-busy="true"]') === null)
        throw new Error('not retrying');
    });
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  args: { isError: true },
};
