import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import {
  type LibraryPageFixture,
  serveLibrary,
} from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

const video = (index: number, title: string) => creatorVideo({ id: videoIdOf(index), title });

const PAGES: LibraryPageFixture[] = [
  { cursor: null, items: [video(0, 'Lisbon at night'), video(1, 'Harbour at dawn')], next: 'c2' },
  { cursor: 'c2', items: [video(2, 'Night bus to Porto'), video(3, 'Tram 28')], next: null },
];

const renderLibrary = (url: string, pages: readonly LibraryPageFixture[] = PAGES) => {
  const requests = serveLibrary(pages);
  return renderRoute(getRouter, url, { handlers: [signInBrowser()] }).then((rendered) => ({
    ...rendered,
    requests,
  }));
};

const searchOf = (router: { state: { location: { searchStr: string } } }) =>
  Object.fromEntries(new URLSearchParams(router.state.location.searchStr));

const shownTitles = () =>
  within(screen.getAllByRole('rowgroup')[1] as HTMLElement)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('button')[0]?.textContent);

describe('apps/client/studio: /videos', () => {
  it('lists the first page, newest first, with the date column marked as the sort', async () => {
    const { requests } = await renderLibrary('/videos');

    expect(await screen.findByRole('table', { name: 'Your videos' })).toBeInTheDocument();
    expect(shownTitles()).toEqual(['Lisbon at night', 'Harbour at dawn']);
    expect(requests).toEqual([{ sort: 'newest', cursor: null }]);
    expect(screen.getByRole('columnheader', { name: /Date/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  });

  it('sorts by the clicked column, and says so in the address', async () => {
    const { requests, router, user } = await renderLibrary('/videos');

    await user.click(await screen.findByRole('button', { name: /Views/ }));

    await vi.waitFor(() => expect(searchOf(router)).toEqual({ sort: 'views', page: '1' }));
    expect(requests.at(-1)).toEqual({ sort: 'views', cursor: null });
    expect(await screen.findByRole('columnheader', { name: /Views/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  });

  it('pages by cursor, and says so in the address', async () => {
    const { router, user } = await renderLibrary('/videos');

    await user.click(await screen.findByRole('button', { name: 'Next page' }));

    await vi.waitFor(() => expect(searchOf(router)).toMatchObject({ page: '2' }));
    await vi.waitFor(() => expect(shownTitles()).toEqual(['Night bus to Porto', 'Tram 28']));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('restores the sort, the page and the filter from the address', async () => {
    const { requests } = await renderLibrary('/videos?sort=likes&page=2&q=night');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(requests).toEqual([
      { sort: 'likes', cursor: null },
      { sort: 'likes', cursor: 'c2' },
    ]);
    expect(shownTitles()).toEqual(['Night bus to Porto']);
    expect(screen.getByRole('searchbox', { name: 'Filter by title' })).toHaveValue('night');
  });

  it('filters the page by title as it is typed, and keeps the filter in the address', async () => {
    const { router, user } = await renderLibrary('/videos');

    await user.type(await screen.findByRole('searchbox', { name: 'Filter by title' }), 'harb');

    expect(shownTitles()).toEqual(['Harbour at dawn']);
    expect(searchOf(router)).toMatchObject({ q: 'harb' });
  });

  it('says so when no video on the page matches the filter', async () => {
    await renderLibrary('/videos?q=zzz');

    expect(await screen.findByText('No video on this page matches the filter')).toBeInTheDocument();
  });

  it('offers an upload when the creator has no video yet', async () => {
    await renderLibrary('/videos', [{ cursor: null, items: [], next: null }]);

    expect(await screen.findByText('You have not uploaded a video yet')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      '/upload'
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
