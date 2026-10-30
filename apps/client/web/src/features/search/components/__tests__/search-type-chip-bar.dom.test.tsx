import { screen } from '@testing-library/react';

import {
  channelHit,
  page,
  renderSearch,
  searchReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';

const everything = (params: URLSearchParams) =>
  params.get('type') === 'channel'
    ? page([channelHit()], { total: 31 })
    : page([videoResult(), channelHit()], { total: 2400 });

describe('apps/client/web: SearchTypeChipBar', () => {
  it('narrows the results to one kind and replaces the URL instead of stacking it', async () => {
    const asked: string[] = [];
    const { user, router } = await renderSearch('/search?q=react', [
      searchReply(everything, asked),
    ]);
    const before = router.history.length;

    await user.click(await screen.findByRole('radio', { name: /Channels/ }));

    expect(await screen.findByRole('radio', { name: /Channels/ })).toBeChecked();
    expect(router.state.location.search).toEqual({ q: 'react', type: 'channel' });
    expect(router.history.length).toBe(before);
    expect(asked).toContain('q=react&type=channel&sort=relevance&limit=30');
    expect(screen.queryByRole('link', { name: 'React in practice' })).not.toBeInTheDocument();
  });

  it('prints the total on the chip of the kind shown', async () => {
    await renderSearch('/search?q=react&type=channel', [searchReply(everything)]);

    expect(await screen.findByRole('radio', { name: 'Channels 31' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Videos' })).not.toBeChecked();
  });

  it.each([
    { url: '/search?q=react', checked: 'All' },
    { url: '/search?q=react&type=bogus', checked: 'All' },
    { url: '/search?q=react&type=playlist', checked: 'Playlists' },
  ])('reads $url with $checked chosen', async ({ url, checked }) => {
    await renderSearch(url, [searchReply(everything)]);

    expect(await screen.findByRole('radio', { name: new RegExp(`^${checked}`) })).toBeChecked();
  });
});
