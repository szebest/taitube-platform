import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextMenu } from '..';
import { ContextMenuContent } from '../context-menu';

const meta = {
  title: 'Primitives/ContextMenu',
  component: ContextMenuContent,
  tags: ['motion'],
} satisfies Meta<typeof ContextMenuContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VideoCardRegion: Story = {
  render: (args) => (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          type="button"
          className="m-section grid h-40 max-w-[24rem] place-items-center rounded-card bg-surface text-fg focus-ring"
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
