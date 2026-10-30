import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenu, Icon, Textarea } from '@vp/ui';
import type { ReactNode } from 'react';
import { CommentItem, CommentItemSkeleton } from '.';
import { CommentItemRoot } from './comment-item';

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#3d6aa1"/></svg>'
)}`;

const LONG_TEXT = Array.from(
  { length: 9 },
  (_, line) => `Line ${line + 1}: the tram bell, the rain on the awnings, a dog two streets away.`
).join('\n');

const noop = () => undefined;

function Comment({
  children = 'The tram at 02:15 is the best sound design this year.',
  creator = false,
  edited = false,
  pinned = false,
  replies,
}: {
  children?: ReactNode;
  creator?: boolean;
  edited?: boolean;
  pinned?: boolean;
  replies?: ReactNode;
}) {
  return (
    <>
      {pinned && <CommentItem.Pinned />}
      <CommentItem.Author
        name={creator ? 'Marta Reis Films' : 'Ines Carvalho'}
        avatarSrc={AVATAR}
        time="3 days ago"
        dateTime="2026-10-14T09:12:00Z"
        creator={creator}
        edited={edited}
      >
        {/* biome-ignore lint/a11y/useAnchorContent: the kit draws the content into the link */}
        <a href="#comment-1" />
      </CommentItem.Author>
      <CommentItem.Body>{children}</CommentItem.Body>
      <CommentItem.Failed onRetry={noop} onDelete={noop} />
      <CommentItem.Actions>
        <CommentItem.Reactions value={null} likes="128" onChange={noop} />
        <CommentItem.Reply onClick={noop} />
        <CommentItem.Menu>
          <DropdownMenu.Item>
            <Icon name="edit" />
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item tone="danger">
            <Icon name="trash" />
            Delete
          </DropdownMenu.Item>
        </CommentItem.Menu>
      </CommentItem.Actions>
      {replies}
    </>
  );
}

const frame: Decorator = (Story) => (
  <div className="tw:max-w-[44rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/CommentItem',
  component: CommentItemRoot,
  decorators: [frame],
} satisfies Meta<typeof CommentItemRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment />
    </CommentItem.Root>
  ),
};

export const CreatorPinned: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment creator pinned>
        Thank you all for watching. The full audio is on the channel.
      </Comment>
    </CommentItem.Root>
  ),
};

export const MentionLinkAndTimecode: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment>
        <a href="/channel/marta">@martareis</a> the tram at{' '}
        <CommentItem.Timecode seconds={135} onSeek={noop}>
          02:15
        </CommentItem.Timecode>{' '}
        is the best sound design this year. More at <a href="/watch/alfama">Alfama at 5 a.m.</a>
      </Comment>
    </CommentItem.Root>
  ),
};

export const LongCollapsed: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment>{LONG_TEXT}</Comment>
    </CommentItem.Root>
  ),
};

export const LongExpanded: Story = {
  render: LongCollapsed.render,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Read more' }));
  },
};

export const Edited: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment edited />
    </CommentItem.Root>
  ),
};

export const Editing: Story = {
  args: { state: 'editing' },
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment>
        <Textarea
          aria-label="Edit comment"
          defaultValue="The tram at 02:15 is the best sound design this year."
        />
      </Comment>
    </CommentItem.Root>
  ),
};

export const Pending: Story = {
  args: { state: 'pending' },
  render: Plain.render,
};

export const Failed: Story = {
  args: { state: 'failed' },
  render: Plain.render,
};

export const Deleted: Story = {
  args: { state: 'deleted' },
  render: Plain.render,
};

export const Removed: Story = {
  args: { state: 'removed' },
  render: Plain.render,
};

export const Reply: Story = {
  args: { level: 'reply' },
  render: Plain.render,
};

export const RepliesExpanded: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment
        replies={
          <CommentItem.Replies count="2" expanded onToggle={noop}>
            <CommentItem.Root level="reply">
              <Comment creator>Thank you, it was a lucky night.</Comment>
            </CommentItem.Root>
            <CommentItem.Root level="reply">
              <Comment>Same, I have it on repeat.</Comment>
            </CommentItem.Root>
          </CommentItem.Replies>
        }
      />
    </CommentItem.Root>
  ),
};

export const RepliesCollapsed: Story = {
  render: (args) => (
    <CommentItem.Root {...args}>
      <Comment replies={<CommentItem.Replies count="14" expanded={false} onToggle={noop} />} />
    </CommentItem.Root>
  ),
};

export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  render: CreatorPinned.render,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <CommentItemSkeleton />
      <CommentItemSkeleton level="reply" />
    </div>
  ),
};
