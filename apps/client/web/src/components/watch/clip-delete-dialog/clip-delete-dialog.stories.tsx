import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipDeleteDialog } from '.';

const meta = {
  title: 'Web/ClipDeleteDialog',
  tags: ['text'],
  component: ClipDeleteDialog,
  args: {
    triggerLabel: 'Delete clip',
    title: 'Delete this clip?',
    description: 'Its link stops working. The video is not affected.',
    confirmLabel: 'Delete',
    onConfirm: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-section">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClipDeleteDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const ConfirmOpen: Story = {
  args: { defaultOpen: true },
};

export const Deleting: Story = {
  args: { defaultOpen: true, pending: true },
};
