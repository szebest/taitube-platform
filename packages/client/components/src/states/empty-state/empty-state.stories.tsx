import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '@vp/ui';
import { EmptyLibraryIllustration, NoResultsIllustration } from '../../illustrations';
import { EmptyState, emptyStateStyles } from '.';
import { EmptyStateRoot } from './empty-state';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyStateRoot,
} satisfies Meta<typeof EmptyStateRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EverySize: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      {variantNames(emptyStateStyles.variants.size).map((size) => (
        <EmptyState.Root key={size} {...args} size={size}>
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title asChild>
            <h2>Nothing queued yet</h2>
          </EmptyState.Title>
          <EmptyState.Description>
            Save a video from anywhere and it will wait here, in the order you chose.
          </EmptyState.Description>
          <EmptyState.Action asChild>
            <a href="/">Browse videos</a>
          </EmptyState.Action>
          <EmptyState.Secondary href="/help">Learn how queues work</EmptyState.Secondary>
        </EmptyState.Root>
      ))}
    </div>
  ),
};

export const EditorialTitle: Story = {
  render: (args) => (
    <EmptyState.Root {...args} size="section" titleStyle="editorial">
      <EmptyState.Illustration>
        <NoResultsIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h2>Nothing matches that, yet</h2>
      </EmptyState.Title>
      <EmptyState.Action>Clear the filter</EmptyState.Action>
    </EmptyState.Root>
  ),
};
