import { screen, within } from '@testing-library/react';
import { createVideoThread } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import { THREAD_ID } from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const startButtons = () => screen.getAllByRole('button', { name: 'Start a thread at 01:15' });

describe('apps/client/web: StartThreadAction', () => {
  it('is offered in the engagement bar and under the comment composer, both at the playhead', async () => {
    await renderThreads({ viewer: viewerAccount() });

    const bar = within(screen.getByRole('toolbar', { name: 'Video actions' }));

    expect(bar.getByRole('button', { name: 'Start a thread at 01:15' })).toBeInTheDocument();
    expect(startButtons()).toHaveLength(2);
  });

  it('starts a thread at the playhead and opens it in its panel', async () => {
    const { user, sent, router } = await renderThreads({ viewer: viewerAccount() });

    await user.click(startButtons()[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Start a thread' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'The twist');
    await user.click(within(dialog).getByRole('button', { name: 'Start thread' }));

    expect(
      await screen.findByRole('dialog', { name: 'The twist at the tram' })
    ).toBeInTheDocument();
    expect(sent.threads).toEqual([{ anchorMs: 75_000, title: 'The twist', body: '' }]);
    expect(router.state.location.search).toMatchObject({ tab: 'threads', thread: THREAD_ID });
  });

  it('asks a guest to sign in instead of opening the form', async () => {
    const { user } = await renderThreads();

    await user.click(startButtons()[0] as HTMLElement);

    expect(await screen.findByRole('dialog', { name: 'Sign in to comment' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Start a thread' })).not.toBeInTheDocument();
  });

  it.each([
    { code: ErrorCodes.THREAD_LIMIT, copy: 'You already have 5 open threads on this video.' },
    { code: ErrorCodes.THREAD_ANCHOR_INVALID, copy: 'Pick a moment inside the video.' },
  ])('tells the viewer when the thread is refused with $code', async ({ code, copy }) => {
    const { user } = await renderThreads({
      viewer: viewerAccount(),
      handlers: [mockEndpoint(createVideoThread, () => problemReply(code))],
    });

    await user.click(startButtons()[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Start a thread' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Again');
    await user.click(within(dialog).getByRole('button', { name: 'Start thread' }));

    expect(await screen.findByText('Your thread could not be started')).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
  });
});
