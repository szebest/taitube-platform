import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import {
  OTHER_THREAD_ID,
  THREAD_ID,
  thread,
  threadList,
} from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: watch discussion', () => {
  it('offers Comments and Threads, with Comments selected until the URL says otherwise', async () => {
    await renderThreads();

    const tabs = within(screen.getByRole('tablist', { name: 'Discussion' }));

    expect(tabs.getByRole('tab', { name: 'Comments' })).toHaveAttribute('aria-selected', 'true');
    expect(tabs.getByRole('tab', { name: 'Threads' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens on Threads when the URL asks and lists the threads in the order the API gave them', async () => {
    await renderThreads({
      search: '?tab=threads',
      list: threadList([
        thread({ title: 'First one', isPinned: true }),
        thread({ id: OTHER_THREAD_ID, title: 'Second one', anchorMs: 3_000, replyCount: 1 }),
      ]),
    });

    const items = await screen.findAllByRole('button', { name: /First one|Second one/ });

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('First one'),
      expect.stringContaining('Second one'),
    ]);
    expect(items[0]).toHaveTextContent('Pinned');
    expect(items[1]).toHaveTextContent('At 00:03');
    expect(items[1]).toHaveTextContent('1 reply');
  });

  it('moves to Threads when the tab is chosen and back again', async () => {
    await renderThreads({
      list: threadList([thread({ title: 'The twist' })]),
    });

    await userEvent.click(screen.getByRole('tab', { name: 'Threads' }));

    expect(await screen.findByRole('button', { name: /The twist/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Comments' }));

    expect(screen.queryByRole('button', { name: /The twist/ })).not.toBeInTheDocument();
  });

  it('opens the thread the URL names in its panel and closes it on Escape', async () => {
    await renderThreads({ search: `?tab=threads&thread=${THREAD_ID}` });

    const panel = await screen.findByRole('dialog', { name: 'The twist at the tram' });

    expect(within(panel).getByText('Did anyone catch the second sign?')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a thread from the list', async () => {
    await renderThreads({ search: '?tab=threads' });

    await userEvent.click(await screen.findByRole('button', { name: /The twist at the tram/ }));

    expect(
      await screen.findByRole('dialog', { name: 'The twist at the tram' })
    ).toBeInTheDocument();
  });
});
