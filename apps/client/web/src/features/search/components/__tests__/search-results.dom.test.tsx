import { screen, within } from '@testing-library/react';

import {
  channelHit,
  page,
  playlistResult,
  renderSearch,
  searchReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';

const resultList = (query: string) => screen.findByRole('list', { name: `Results for ${query}` });

const resultItems = async (query: string) => {
  const items = within(await resultList(query)).getAllByRole('listitem');
  const at = (index: number) => {
    const item = items[index];
    if (!item) {
      throw new Error(`no result at ${index}`);
    }
    return item;
  };
  return { items, at };
};

const OTHER_CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c002';

const MIXED = page([
  videoResult(),
  channelHit({ displayName: 'Other React', id: OTHER_CHANNEL_ID }),
  playlistResult(),
]);

describe('apps/client/web: search results in the browser', () => {
  it('renders a video, a channel and a playlist with the fields of each, matched terms marked', async () => {
    await renderSearch('/search?q=react', [searchReply(() => MIXED)]);

    const { at } = await resultItems('react');

    expect(within(at(0)).getByRole('link', { name: 'React in practice' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/watch\//)
    );
    expect(at(0)).toHaveTextContent('1.5K views');
    expect(at(0)).toHaveTextContent('Learn React the practical way');
    expect(at(0)).toHaveTextContent('10:12');
    expect([...at(0).querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
      'React',
      'React',
    ]);
    expect(at(1)).toHaveTextContent('Other React');
    expect(at(1)).toHaveTextContent('@reactconf');
    expect(at(1)).toHaveTextContent('4.2K subscribers');
    expect(within(at(1)).getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(at(2)).toHaveTextContent('12 videos');
    expect(within(at(2)).getByRole('link', { name: 'React course' })).toHaveAttribute(
      'href',
      '/playlist?list=0190c3a0-5e1d-7000-8000-00000000d001'
    );
  });

  it('spotlights a channel the query names exactly above the blended results', async () => {
    await renderSearch('/search?q=react%20conf', [
      searchReply(() => page([channelHit(), videoResult()])),
    ]);

    const { items, at } = await resultItems('react conf');

    expect(items).toHaveLength(1);
    expect(at(0)).toHaveTextContent('React in practice');
    expect(screen.getAllByRole('heading', { name: 'React Conf' })).toHaveLength(1);
  });

  it.each([
    {
      label: 'another kind is chosen',
      url: '/search?q=react%20conf&type=channel',
      query: 'react conf',
    },
    { label: 'the channel only half matches', url: '/search?q=react', query: 'react' },
  ])('lists the channel in the results, not above them, when $label', async ({ url, query }) => {
    await renderSearch(url, [searchReply(() => page([channelHit(), videoResult()]))]);

    const { items, at } = await resultItems(query);

    expect(items).toHaveLength(2);
    expect(within(at(0)).getByRole('heading', { name: 'React Conf' })).toBeInTheDocument();
  });

  it('says the matches are close ones when the words found nothing as typed', async () => {
    await renderSearch('/search?q=reakt', [
      searchReply(() => page([videoResult()], { fuzzyFallback: true })),
    ]);

    const banner = await screen.findByRole('status');

    expect(banner).toHaveTextContent('No exact matches for reakt');
    expect(banner).toHaveTextContent('These are the closest matches instead.');
  });

  it('shows no banner when the words matched', async () => {
    await renderSearch('/search?q=react', [searchReply(() => MIXED)]);

    await resultList('react');

    expect(screen.queryByText(/No exact matches/)).not.toBeInTheDocument();
  });

  it('holds each thumbnail in a fixed frame, so no row shifts when the image arrives', async () => {
    await renderSearch('/search?q=react', [searchReply(() => MIXED)]);

    await resultList('react');

    for (const thumb of document.querySelectorAll('[data-slot="video-card-thumb"]')) {
      expect(thumb.className).toMatch(/aspect/);
    }
  });

  it('keeps marked terms in the results when the page reads right to left', async () => {
    document.documentElement.dir = 'rtl';
    await renderSearch('/search?q=react', [searchReply(() => MIXED)]);

    await resultList('react');

    expect(document.querySelectorAll('li mark').length).toBeGreaterThan(0);
    expect(document.querySelector('ul')?.outerHTML).not.toMatch(/tw:(left|right|ml|mr|pl|pr)-/);
    document.documentElement.dir = '';
  });
});
