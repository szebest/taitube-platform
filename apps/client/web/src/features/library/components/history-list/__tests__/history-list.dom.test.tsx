import { screen, waitFor, within } from '@testing-library/react';
import { historyItem } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '#app/features/library/__tests__/render-library';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

const HISTORY = [
  historyItem(1, { title: 'Tram ride' }),
  historyItem(2, { title: 'Last week', watchedAt: '2026-03-06T00:00:00.000Z' }),
  historyItem(3, { title: 'Yesterday', watchedAt: '2026-03-09T00:00:00.000Z' }),
  historyItem(4, { title: 'Old film', watchedAt: '2025-01-01T00:00:00.000Z' }),
];

describe('apps/client/web: the watch history list', () => {
  useLibraryClock();

  it('groups the videos by day, newest group first', async () => {
    await renderLibrary('/feed/history', { history: HISTORY });

    await screen.findByRole('link', { name: 'Tram ride' });

    const titlesIn = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('article')
        .map((card) => card.querySelector('[data-slot=video-card-title]')?.textContent);
    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map(({ textContent }) => textContent)
    ).toEqual(['Today', 'Yesterday', 'This week', 'Older']);
    expect(titlesIn('Today')).toEqual(['Tram ride']);
    expect(titlesIn('Yesterday')).toEqual(['Yesterday']);
    expect(titlesIn('This week')).toEqual(['Last week']);
    expect(titlesIn('Older')).toEqual(['Old film']);
  });

  it('shows one line when nothing was watched', async () => {
    await renderLibrary('/feed/history');

    expect(await screen.findByText('Nothing watched yet')).toBeInTheDocument();
  });

  it.each([
    { q: 'TRAM', shown: ['Tram ride'] },
    { q: 'last', shown: ['Last week'] },
  ])('keeps the titles that hold "$q"', async ({ q, shown }) => {
    await renderLibrary(`/feed/history?q=${q}`, { history: HISTORY });

    await screen.findByRole('link', { name: shown[0] });

    const titles = HISTORY.map(({ video }) => video.title ?? '');
    expect(titles.filter((title) => screen.queryByRole('link', { name: title }))).toEqual(shown);
  });

  it('says so when no title matches', async () => {
    await renderLibrary('/feed/history?q=metro', { history: HISTORY });

    expect(await screen.findByText('Nothing in your history matches metro')).toBeInTheDocument();
  });

  describe('paging by keyset', () => {
    beforeEach(() => RecordingObserver.install());
    afterEach(() => vi.unstubAllGlobals());

    it('asks for the next page with the cursor once the end is near', async () => {
      const calls: string[] = [];
      await renderLibrary('/feed/history', { history: HISTORY, pageSize: 2, calls });
      await screen.findByRole('link', { name: 'Tram ride' });
      expect(screen.queryByRole('link', { name: 'Old film' })).toBeNull();

      RecordingObserver.enterView();

      expect(await screen.findByRole('link', { name: 'Old film' })).toBeInTheDocument();
      await waitFor(() =>
        expect(calls.filter((call) => call === 'GET /v1/me/history')).toHaveLength(2)
      );
    });
  });
});
