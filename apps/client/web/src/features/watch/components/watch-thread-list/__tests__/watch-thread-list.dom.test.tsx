import { screen } from '@testing-library/react';
import { listVideoThreads } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import { threadList } from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: WatchThreadList', () => {
  it('describes each thread by its moment, title and reply count', async () => {
    await renderThreads({ search: '?tab=threads' });

    const item = await screen.findByRole('button', { name: /The twist at the tram/ });

    expect(item).toHaveTextContent('At 01:05');
    expect(item).toHaveTextContent('2 replies');
    expect(item).not.toHaveTextContent('Pinned');
  });

  it('invites the viewer to start the first thread when there are none', async () => {
    await renderThreads({ search: '?tab=threads', list: threadList([]) });

    expect(
      await screen.findByText('No threads yet. Start one at a moment of the video.')
    ).toBeInTheDocument();
  });

  it('keeps a failed list inside its section', async () => {
    await renderThreads({
      search: '?tab=threads',
      handlers: [mockEndpoint(listVideoThreads, () => problemReply(ErrorCodes.INTERNAL))],
    });

    expect(await screen.findByText('The threads could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
