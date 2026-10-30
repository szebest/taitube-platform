import { screen, within } from '@testing-library/react';

import {
  historyReply,
  openPalette,
  removeHistoryReply,
} from '#app/features/search/__tests__/search-fixtures';

const LOFI_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
const JAZZ_ID = '0190c3a0-5e1d-7000-8000-00000000e002';

describe('apps/client/web: RecentSearchGroup', () => {
  it('lists the newest searches of a signed-in viewer', async () => {
    await openPalette(
      '/',
      [
        historyReply([
          { id: LOFI_ID, query: 'lofi' },
          { id: JAZZ_ID, query: 'jazz' },
        ]),
      ],
      true
    );

    const recent = await screen.findByRole('group', { name: 'Recent searches' });

    expect(
      within(recent)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['lofi', 'jazz']);
  });

  it('renders nothing when there are no recent searches', async () => {
    await openPalette('/', [historyReply([])], true);

    expect(screen.queryByRole('group', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  it('shows a guest none', async () => {
    await openPalette('/', [historyReply([{ id: LOFI_ID, query: 'lofi' }])]);

    expect(screen.queryByRole('group', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  it('runs a search again and closes the palette', async () => {
    const { user, router } = await openPalette(
      '/',
      [historyReply([{ id: LOFI_ID, query: 'lofi' }])],
      true
    );

    await user.click(
      within(await screen.findByRole('group', { name: 'Recent searches' })).getByText('lofi')
    );

    expect(router.state.location.search).toEqual({ q: 'lofi' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes one by its button without running it', async () => {
    const removed: string[] = [];
    const { user, router } = await openPalette(
      '/',
      [historyReply([{ id: JAZZ_ID, query: 'jazz' }]), removeHistoryReply(removed)],
      true
    );

    await user.click(
      await screen.findByRole('button', { name: 'Remove jazz from recent searches' })
    );

    expect(removed).toEqual([JAZZ_ID]);
    expect(router.state.location.pathname).toBe('/');
  });

  it('removes the one a keyboard user tabbed to instead of running it', async () => {
    const removed: string[] = [];
    const { user, router } = await openPalette(
      '/',
      [historyReply([{ id: LOFI_ID, query: 'lofi' }]), removeHistoryReply(removed)],
      true
    );
    const remove = await screen.findByRole('button', { name: 'Remove lofi from recent searches' });

    await user.tab();
    await user.tab();
    expect(remove).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(removed).toEqual([LOFI_ID]);
    expect(router.state.location.pathname).toBe('/');
  });
});
