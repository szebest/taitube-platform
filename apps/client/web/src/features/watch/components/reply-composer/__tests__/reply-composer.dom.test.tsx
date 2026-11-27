import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryClient } from '@vp/queries';
import { AppProviders } from '#app/__tests__/providers';
import { CommentThread } from '#app/components/watch/comment-thread';
import { ReplyComposer, type ReplyComposerProps } from '../reply-composer';

const onChange = vi.fn();
const onSend = vi.fn();

const renderComposer = (props: Partial<ReplyComposerProps> = {}) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>
        <CommentThread.Root sort="top" onSortChange={() => {}}>
          <ReplyComposer draft="" onChange={onChange} onSend={onSend} sending={false} {...props} />
        </CommentThread.Root>
      </AppProviders>
    </QueryClientProvider>
  );

describe('apps/client/web: reply composer', () => {
  it('hands each edit of the draft back', async () => {
    renderComposer();

    await userEvent.setup().type(screen.getByRole('textbox'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('offers to send a non-empty draft', () => {
    renderComposer({ draft: 'Same here' });

    expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled();
  });

  it('does not offer to send an empty draft', () => {
    renderComposer({ draft: '  ' });

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });
});
