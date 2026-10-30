import { screen, within } from '@testing-library/react';

import {
  channelHit,
  openPalette,
  page,
  playlistResult,
  searchReply,
  suggestionsReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';

async function typed(words: string) {
  const palette = await openPalette('/', [
    searchReply(() => page([videoResult(), channelHit(), playlistResult()])),
    suggestionsReply([{ type: 'query', text: 'react hooks' }]),
  ]);
  await palette.user.type(palette.field, words);
  return palette;
}

const group = async (name: string) => within(await screen.findByRole('group', { name }));

describe('apps/client/web: PaletteResultItem', () => {
  it.each([
    { heading: 'Videos', title: 'React in practice', meta: '10:12' },
    { heading: 'Channels', title: 'React Conf', meta: '4.2K subscribers' },
    { heading: 'Playlists', title: 'React course', meta: '12 videos' },
  ])('shows a $heading row with its title and $meta', async ({ heading, title, meta }) => {
    await typed('re');

    const row = (await group(heading)).getByRole('option');

    expect(row).toHaveTextContent(title);
    expect(row).toHaveTextContent(meta);
  });

  it.each([
    { heading: 'Videos', pathname: /^\/watch\// },
    { heading: 'Channels', pathname: /^\/channel\// },
    { heading: 'Suggestions', pathname: '/search' },
  ])(
    'opens the page a $heading row names and closes the palette',
    async ({ heading, pathname }) => {
      const { user, router } = await typed('re');

      await user.click((await group(heading)).getByRole('option'));

      expect(router.state.location.pathname).toMatch(pathname);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );

  it('runs the words a suggestion offers as a search', async () => {
    const { user, router } = await typed('re');

    await user.click((await group('Suggestions')).getByRole('option'));

    expect(router.state.location.search).toEqual({ q: 'react hooks' });
  });

  it('marks the typed words in the title', async () => {
    await typed('react');

    const row = (await group('Videos')).getByRole('option');

    expect(within(row).getByText('React', { selector: 'mark' })).toBeInTheDocument();
  });
});
