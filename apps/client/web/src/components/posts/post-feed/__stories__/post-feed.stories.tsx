import type { Meta, StoryObj } from '@storybook/react-vite';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import type { PostPageView } from '@vp/api-contracts';
import { openPoll, post } from '#app/__tests__/post-fixtures';
import { PostFeed } from '..';

const page = (items: ReturnType<typeof post>[]) =>
  infiniteQueryOptions<
    PostPageView,
    Error,
    InfiniteData<PostPageView>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['story', 'post-feed', items.length],
    queryFn: async () => ({ items, nextCursor: null }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
  });

const meta = {
  title: 'Web/PostFeed',
  tags: ['text', 'translated'],
  component: PostFeed,
  args: { options: page([post({ pinned: true }), openPoll()]), empty: 'No posts yet' },
  parameters: { app: {} },
  decorators: [
    (Story) => (
      <div className="max-w-[40rem] p-section">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PostFeed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Posts: Story = {};

export const Empty: Story = { args: { options: page([]) } };
