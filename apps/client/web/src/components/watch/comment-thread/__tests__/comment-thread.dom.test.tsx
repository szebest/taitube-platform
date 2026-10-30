import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { CommentItem } from '#app/components/discussion/comment-item';
import { CommentThread, CommentThreadSkeleton } from '..';
import type { CommentThreadComposerProps, CommentThreadRootProps } from '../comment-thread';

interface Setup {
  root?: Partial<CommentThreadRootProps>;
  composer?: Partial<CommentThreadComposerProps>;
  busy?: boolean;
}

const renderThread = ({ root = {}, composer = {}, busy = false }: Setup = {}) =>
  render(
    <AppProviders>
      <CommentThread.Root sort="top" onSortChange={vi.fn()} {...root}>
        <CommentThread.Header>Discussion · 1,284</CommentThread.Header>
        <CommentThread.Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} {...composer} />
        <CommentThread.List busy={busy}>
          <CommentThread.Item>
            <CommentItem.Root>
              <CommentItem.Author name="Ines Carvalho" time="3 days ago" dateTime="2026-10-14" />
              <CommentItem.Body>The tram.</CommentItem.Body>
            </CommentItem.Root>
          </CommentThread.Item>
        </CommentThread.List>
        <CommentThread.More />
      </CommentThread.Root>
    </AppProviders>
  );

describe('apps/client/web: CommentThread', () => {
  it('is a section named by its heading, the comments a list', () => {
    renderThread();

    expect(screen.getByRole('region', { name: 'Discussion · 1,284' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toContainElement(
      screen.getByRole('article', { name: 'Ines Carvalho 3 days ago' })
    );
  });

  it('asks for the other sort from its radio group', async () => {
    const onSortChange = vi.fn();
    renderThread({ root: { onSortChange } });

    await userEvent.click(screen.getByRole('radio', { name: 'Newest' }));

    expect(screen.getByRole('radiogroup', { name: 'Sort comments' })).toBeInTheDocument();
    expect(onSortChange).toHaveBeenCalledWith('newest');
  });

  it('shows the composer actions once focused', async () => {
    renderThread();

    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', { name: 'Add a comment' }));

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  it.each([
    {
      scenario: 'the Comment button',
      submit: () => userEvent.click(screen.getByRole('button', { name: 'Comment' })),
    },
    { scenario: 'Ctrl Enter', submit: () => userEvent.keyboard('{Control>}{Enter}{/Control}') },
    { scenario: 'Cmd Enter', submit: () => userEvent.keyboard('{Meta>}{Enter}{/Meta}') },
  ])('posts with $scenario and keeps focus in the composer', async ({ submit }) => {
    const onSubmit = vi.fn();
    renderThread({ composer: { value: 'Watched it twice.', onSubmit } });
    await userEvent.click(screen.getByRole('textbox'));

    await submit();

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('clears the text on cancel', async () => {
    const onChange = vi.fn();
    renderThread({ composer: { value: 'Draft', onChange } });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('holds the text while submitting and ignores another post', async () => {
    const onSubmit = vi.fn();
    renderThread({ composer: { value: 'Watched it twice.', onSubmit, submitting: true } });

    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('describes the field with the reason a post failed', () => {
    renderThread({ composer: { value: 'Draft', error: 'Your comment was not posted.' } });

    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Your comment was not posted.');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the list busy while the next page loads', () => {
    renderThread({ busy: true });

    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Show more comments' })).toBeInTheDocument();
  });

  it('loads the next page when the end scrolls into view', () => {
    const observed: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observed.push(callback);
        }
        observe() {}
        disconnect() {}
      }
    );
    const onEndReached = vi.fn();
    renderThread({ root: { onEndReached } });

    observed[0]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    expect(onEndReached).toHaveBeenCalledOnce();
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderThread({ composer: { value: 'Draft', error: 'Not posted.' } });
    render(<CommentThreadSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
