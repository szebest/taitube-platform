import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  EmptyState,
  NoCommentsIllustration,
  SectionError,
  SignedOutIllustration,
} from '@vp/components';
import { Drawer } from '@vp/ui';
import { type ReactNode, useState } from 'react';
import { CommentItem } from '#app/components/discussion/comment-item';
import { CommentThread, CommentThreadSkeleton } from '.';
import { CommentThreadRoot } from './comment-thread';
import type { CommentThreadSort } from './types';

const noop = () => undefined;

const COMMENTS = [
  { id: 'c1', name: 'Marta Reis Films', text: 'The full audio is on the channel.', pinned: true },
  {
    id: 'c2',
    name: 'Ines Carvalho',
    text: 'The tram at 02:15 is the best sound design this year.',
  },
  { id: 'c3', name: 'Rui Matos', text: 'I grew up on that street. Thank you.' },
];

function Comments({ pending }: { pending?: string }) {
  return (
    <>
      {pending && (
        <CommentThread.Item>
          <CommentItem.Root state="pending">
            <CommentItem.Author name="You" time="now" dateTime="2026-10-26T09:00:00Z" />
            <CommentItem.Body>{pending}</CommentItem.Body>
          </CommentItem.Root>
        </CommentThread.Item>
      )}
      {COMMENTS.map(({ id, name, text, pinned }) => (
        <CommentThread.Item key={id}>
          <CommentItem.Root>
            {pinned && <CommentItem.Pinned />}
            <CommentItem.Author
              name={name}
              time="3 days ago"
              dateTime="2026-10-14T09:12:00Z"
              creator={pinned}
            />
            <CommentItem.Body>{text}</CommentItem.Body>
            <CommentItem.Actions>
              <CommentItem.Reactions value={null} likes="128" onChange={noop} />
              <CommentItem.Reply />
            </CommentItem.Actions>
            <CommentItem.Replies count="2" expanded={false} onToggle={noop} />
          </CommentItem.Root>
        </CommentThread.Item>
      ))}
    </>
  );
}

function Thread({
  args,
  composer,
  children,
}: {
  args: Partial<Parameters<typeof CommentThreadRoot>[0]>;
  composer?: ReactNode;
  children: ReactNode;
}) {
  const [sort, setSort] = useState<CommentThreadSort>('top');
  const [value, setValue] = useState('');

  return (
    <CommentThread.Root {...args} sort={sort} onSortChange={setSort}>
      <CommentThread.Header>Discussion · 1,284</CommentThread.Header>
      {composer ?? <CommentThread.Composer value={value} onChange={setValue} onSubmit={noop} />}
      {children}
    </CommentThread.Root>
  );
}

const frame: Decorator = (Story) => (
  <div className="tw:max-w-[48rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/CommentThread',
  component: CommentThreadRoot,
  args: { sort: 'top', onSortChange: noop },
  decorators: [frame],
} satisfies Meta<typeof CommentThreadRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PinnedFirst: Story = {
  render: (args) => (
    <Thread args={args}>
      <CommentThread.List>
        <Comments />
      </CommentThread.List>
      <CommentThread.More />
    </Thread>
  ),
};

export const Loading: Story = {
  render: () => <CommentThreadSkeleton />,
};

export const Empty: Story = {
  render: (args) => (
    <Thread args={args}>
      <EmptyState.Root size="section">
        <EmptyState.Illustration>
          <NoCommentsIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>Nobody has said anything yet</EmptyState.Title>
        <EmptyState.Action>Start the discussion</EmptyState.Action>
      </EmptyState.Root>
    </Thread>
  ),
};

export const ErrorState: Story = {
  name: 'Error',
  render: (args) => (
    <Thread args={args}>
      <SectionError.Root onRetry={noop}>
        <SectionError.Message>The discussion could not be loaded.</SectionError.Message>
      </SectionError.Root>
    </Thread>
  ),
};

export const CommentsDisabled: Story = {
  render: (args) => (
    <Thread args={args} composer={<span />}>
      <p className="tw:m-0 tw:text-body tw:text-fg-muted">The creator turned comments off.</p>
    </Thread>
  ),
};

export const SignedOut: Story = {
  render: (args) => (
    <Thread
      args={args}
      composer={
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <SignedOutIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>Sign in to join the discussion</EmptyState.Title>
          <EmptyState.Action asChild>
            <a href="/login">Sign in</a>
          </EmptyState.Action>
        </EmptyState.Root>
      }
    >
      <CommentThread.List>
        <Comments />
      </CommentThread.List>
    </Thread>
  ),
};

export const ComposerFocused: Story = {
  render: PinnedFirst.render,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('textbox', { name: 'Add a comment' }));
  },
};

export const Submitting: Story = {
  render: (args) => (
    <Thread
      args={args}
      composer={
        <CommentThread.Composer
          value="Watched it twice."
          onChange={noop}
          onSubmit={noop}
          submitting
        />
      }
    >
      <CommentThread.List>
        <Comments pending="Watched it twice." />
      </CommentThread.List>
    </Thread>
  ),
};

export const SubmitFailed: Story = {
  render: (args) => (
    <Thread
      args={args}
      composer={
        <CommentThread.Composer
          value="Watched it twice."
          onChange={noop}
          onSubmit={noop}
          error="Your comment was not posted. Try again."
        />
      }
    >
      <CommentThread.List>
        <Comments />
      </CommentThread.List>
    </Thread>
  ),
};

export const LoadingMore: Story = {
  render: (args) => (
    <Thread args={args}>
      <CommentThread.List busy>
        <Comments />
      </CommentThread.List>
      <CommentThread.More loading />
    </Thread>
  ),
};

export const Sheet: Story = {
  args: { layout: 'sheet' },
  render: (args) => (
    <Drawer.Root open>
      <Drawer.Content aria-describedby={undefined}>
        <Drawer.Title className="tw:sr-only">Comments</Drawer.Title>
        <Drawer.Body className="tw:h-[70vh]">
          <ThreadInSheet args={args} />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  ),
};

function ThreadInSheet({ args }: { args: Partial<Parameters<typeof CommentThreadRoot>[0]> }) {
  const [sort, setSort] = useState<CommentThreadSort>('newest');
  const [value, setValue] = useState('');

  return (
    <CommentThread.Root {...args} sort={sort} onSortChange={setSort}>
      <CommentThread.Header>Comments · 86</CommentThread.Header>
      <CommentThread.List>
        <Comments />
      </CommentThread.List>
      <CommentThread.Composer value={value} onChange={setValue} onSubmit={noop} />
    </CommentThread.Root>
  );
}

export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  render: PinnedFirst.render,
};

export const Skeleton: Story = {
  render: () => <CommentThreadSkeleton />,
};
