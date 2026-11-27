import { screen, within } from '@testing-library/react';
import { getThread } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { stubSeek } from '#app/__tests__/stub-player';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import { thread } from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

async function openThread(options: Parameters<typeof renderThreads>[0] = {}) {
  const rendered = await renderThreads({ search: '?tab=threads', ...options });
  await rendered.user.click(await screen.findByRole('button', { name: /The twist at the tram/ }));
  return rendered;
}

describe('apps/client/web: WatchThreadPanel', () => {
  it('shows the thread: its title, its moment and its text', async () => {
    await openThread();

    const panel = within(await screen.findByRole('dialog', { name: 'The twist at the tram' }));

    expect(panel.getByRole('button', { name: 'Go to 01:05' })).toHaveTextContent('01:05');
    expect(panel.getByText('Did anyone catch the second sign?')).toBeInTheDocument();
  });

  it('leaves the text out of a thread that has none', async () => {
    await openThread({ detail: thread({ body: '' }) });

    const panel = await screen.findByRole('dialog', { name: 'The twist at the tram' });
    await screen.findByText('No replies yet');

    expect(panel.querySelector('[data-slot="thread-panel-body"]')).toBeNull();
  });

  it('seeks the player to the thread moment from the chip', async () => {
    stubSeek.mockClear();
    const { user } = await openThread();

    await user.click(await screen.findByRole('button', { name: 'Go to 01:05' }));

    expect(stubSeek).toHaveBeenCalledWith(65);
  });

  it('says so when the thread cannot be loaded', async () => {
    await openThread({
      handlers: [mockEndpoint(getThread, () => problemReply(ErrorCodes.THREAD_NOT_FOUND))],
    });

    expect(await screen.findByText('The thread could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Open thread' })).toBeInTheDocument();
  });
});
