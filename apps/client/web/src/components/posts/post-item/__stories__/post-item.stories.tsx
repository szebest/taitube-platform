import type { Meta, StoryObj } from '@storybook/react-vite';
import { openPoll, post } from '#app/__tests__/post-fixtures';
import { PostItem } from '..';

const meta = {
  title: 'Web/PostItem',
  tags: ['text', 'translated'],
  component: PostItem,
  args: { post: post() },
  parameters: { app: {} },
  decorators: [
    (Story) => (
      <div className="max-w-[40rem] p-section">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PostItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {};

export const Pinned: Story = { args: { post: post({ pinned: true, isEdited: true }) } };

export const Poll: Story = { args: { post: openPoll() } };
