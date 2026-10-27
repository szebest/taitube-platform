import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DropdownMenu } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';
import type { ReactNode } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { CommentItem, CommentItemSkeleton } from '..';
import type { CommentItemRootProps } from '../comment-item';
import type { CommentReaction } from '../types';

interface Setup extends Partial<CommentItemRootProps> {
  reaction?: CommentReaction;
  onReact?: (next: CommentReaction) => void;
  onSeek?: (seconds: number) => void;
  onRetry?: () => void;
  replies?: ReactNode;
}

const renderComment = ({
  reaction = null,
  onReact = vi.fn(),
  onSeek = vi.fn(),
  onRetry = vi.fn(),
  replies,
  ...root
}: Setup = {}) =>
  render(
    <AppProviders>
      <CommentItem.Root {...root}>
        <CommentItem.Pinned />
        <CommentItem.Author
          name="Ines Carvalho"
          time="3 days ago"
          dateTime="2026-10-14T09:12:00Z"
          creator
          edited
        >
          {/* biome-ignore lint/a11y/useAnchorContent: the kit draws the content into the link */}
          <a href="#comment-1" />
        </CommentItem.Author>
        <CommentItem.Body>
          The tram at{' '}
          <CommentItem.Timecode seconds={135} onSeek={onSeek}>
            02:15
          </CommentItem.Timecode>{' '}
          is the best sound design this year.
        </CommentItem.Body>
        <CommentItem.Failed onRetry={onRetry} onDelete={vi.fn()} />
        <CommentItem.Actions>
          <CommentItem.Reactions value={reaction} likes="128" onChange={onReact} />
          <CommentItem.Reply />
          <CommentItem.Menu>
            <DropdownMenu.Item>Edit</DropdownMenu.Item>
          </CommentItem.Menu>
        </CommentItem.Actions>
        {replies}
      </CommentItem.Root>
    </AppProviders>
  );

describe('apps/client/web: CommentItem', () => {
  it('is an article named by its author and time, the time a permalink with its datetime', () => {
    renderComment();

    const article = screen.getByRole('article', { name: 'Ines Carvalho 3 days ago' });
    const permalink = within(article).getByRole('link', { name: '3 days ago' });

    expect(permalink).toHaveAttribute('href', '#comment-1');
    expect(permalink.querySelector('time')).toHaveAttribute('datetime', '2026-10-14T09:12:00Z');
    expect(article).toHaveTextContent('Pinned by creator');
    expect(article).toHaveTextContent('Creator');
    expect(article).toHaveTextContent('(edited)');
  });

  it.each([
    { value: null, press: 'Like 128', next: 'LIKE' },
    { value: 'LIKE' as const, press: 'Like 128', next: null },
    { value: null, press: 'Dislike', next: 'DISLIKE' },
  ])('asks for $next when $press is pressed holding $value', async ({ value, press, next }) => {
    const onReact = vi.fn();
    renderComment({ reaction: value, onReact });

    await userEvent.click(screen.getByRole('button', { name: press }));

    expect(onReact).toHaveBeenCalledWith(next);
  });

  it('seeks from a timecode in the text', async () => {
    const onSeek = vi.fn();
    renderComment({ onSeek });

    await userEvent.click(screen.getByRole('button', { name: 'Seek to 02:15' }));

    expect(onSeek).toHaveBeenCalledWith(135);
  });

  it.each([
    { state: 'editing' as const },
    { state: 'pending' as const },
    { state: 'failed' as const },
    { state: 'deleted' as const },
    { state: 'removed' as const },
  ])('hides the actions in the $state state', ({ state }) => {
    renderComment({ state });

    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it.each([
    { state: 'deleted' as const, line: 'This comment was deleted' },
    { state: 'removed' as const, line: 'This comment was removed' },
  ])('replaces the text with a line once $state', ({ state, line }) => {
    renderComment({ state });

    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByText(/best sound design/)).not.toBeInTheDocument();
  });

  it('offers retry for a comment that was not posted', async () => {
    const onRetry = vi.fn();
    renderComment({ state: 'failed', onRetry });

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Not posted')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('toggles a nested list of replies', async () => {
    const onToggle = vi.fn();
    const { rerender } = renderComment({
      replies: <CommentItem.Replies count="14" expanded={false} onToggle={onToggle} />,
    });
    const toggle = screen.getByRole('button', { name: 'View 14 replies' });

    await userEvent.click(toggle);
    rerender(
      <AppProviders>
        <CommentItem.Root>
          <CommentItem.Author name="Ines Carvalho" time="now" dateTime="2026-10-14T09:12:00Z" />
          <CommentItem.Replies count="14" expanded onToggle={onToggle}>
            <CommentItem.Root level="reply">
              <CommentItem.Author name="Marta" time="now" dateTime="2026-10-14T09:12:00Z" />
              <CommentItem.Replies count="1" expanded onToggle={onToggle} />
            </CommentItem.Root>
          </CommentItem.Replies>
        </CommentItem.Root>
      </AppProviders>
    );

    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Hide replies' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(
      within(screen.getByRole('list')).getByRole('article', { name: 'Marta now' })
    ).toBeVisible();
    expect(screen.getAllByRole('button', { name: /replies/ })).toHaveLength(1);
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderComment();
    render(<CommentItemSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
