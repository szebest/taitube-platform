import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextMenu } from '.';
import { ContextMenuContent } from './context-menu';

const meta = {
  title: 'Primitives/ContextMenu',
  component: ContextMenuContent,
} satisfies Meta<typeof ContextMenuContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VideoCardRegion: Story = {
  render: (args) => (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          type="button"
          className="tw:m-section tw:grid tw:h-40 tw:max-w-sm tw:place-items-center tw:rounded-card tw:bg-surface tw:text-fg tw:focus-ring"
        >
          Right-click Lisbon at night
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Content {...args}>
        <ContextMenu.Item>Add to queue</ContextMenu.Item>
        <ContextMenu.Item tone="danger">Not interested</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  ),
};
