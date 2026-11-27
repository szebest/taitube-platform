import { screen } from '@testing-library/react';
import { createThreadComment } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { comment, mockEndpoint, problemReply } from '@vp/web-testing';
import { viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

async function openThread(options: Parameters<typeof renderThreads>[0] = {}) {
  const rendered = await renderThreads({ search: '?tab=threads', ...options });
  await rendered.user.click(await screen.findByRole('button', { name: /The twist at the tram/ }));
  await screen.findByRole('dialog', { name: 'The twist at the tram' });
  return rendered;
}

describe('apps/client/web: ThreadReplies', () => {
  it('lists the replies of the thread under a heading with their count', async () => {
    await openThread({
      replies: [
        comment({ id: '0190c3a0-5e1d-7000-8000-00000000d101', content: 'Yes, the green one' }),
        comment({ id: '0190c3a0-5e1d-7000-8000-00000000d102', content: 'No idea' }),
      ],
    });

    expect(await screen.findByText('Yes, the green one')).toBeInTheDocument();
    expect(screen.getByText('No idea')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Replies/ })).toHaveTextContent('Replies · 2');
  });

  it('says so when there are no replies', async () => {
    await openThread();

    expect(await screen.findByText('No replies yet')).toBeInTheDocument();
  });

  it('sends a reply to the thread and clears the box', async () => {
    const { user, sent } = await openThread({ viewer: viewerAccount() });

    const box = await screen.findByRole('textbox', { name: 'Add a comment' });
    await user.type(box, 'Second sign, left side');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await vi.waitFor(() => expect(sent.replies).toEqual([{ content: 'Second sign, left side' }]));
    await vi.waitFor(() => expect(box).toHaveValue(''));
  });

  it.each([
    { code: ErrorCodes.COMMENTS_BANNED, copy: 'You cannot comment on this channel right now.' },
    { code: ErrorCodes.INTERNAL, copy: 'Something went wrong on our side.' },
  ])('toasts a reply refused with $code and keeps the text', async ({ code, copy }) => {
    const { user } = await openThread({
      viewer: viewerAccount(),
      handlers: [mockEndpoint(createThreadComment, () => problemReply(code))],
    });

    const box = await screen.findByRole('textbox', { name: 'Add a comment' });
    await user.type(box, 'Hello');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(await screen.findByText('Your reply could not be sent')).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(box).toHaveValue('Hello');
  });
});
