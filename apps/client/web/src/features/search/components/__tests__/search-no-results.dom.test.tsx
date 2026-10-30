import { screen } from '@testing-library/react';
import { listCategories } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { page, renderSearch, searchReply } from '#app/features/search/__tests__/search-fixtures';

const topic = (name: string) => ({
  id: CHANNEL_ID,
  slug: name.toLowerCase(),
  name,
  description: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const topics = (names: string[]) =>
  mockEndpoint(listCategories, () => HttpResponse.json(names.map(topic)));

describe('apps/client/web: SearchNoResults', () => {
  it('names the words that found nothing and hints at what to try', async () => {
    await renderSearch('/search?q=zzqx', [searchReply(() => page([])), topics([])]);

    expect(
      await screen.findByRole('heading', { name: 'Nothing matches zzqx' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check the spelling, or start from one of these topics.')
    ).toBeInTheDocument();
  });

  it('offers the topics of the catalogue, each a search of its own', async () => {
    const { user, router } = await renderSearch('/search?q=zzqx', [
      searchReply(() => page([])),
      topics(['Music']),
    ]);

    await user.click(await screen.findByRole('radio', { name: 'Music' }));

    expect(router.state.location.search).toEqual({ q: 'Music' });
  });

  it('shows no topic bar when the catalogue has no topics', async () => {
    await renderSearch('/search?q=zzqx', [searchReply(() => page([])), topics([])]);

    await screen.findByRole('heading', { name: 'Nothing matches zzqx' });

    expect(screen.queryByLabelText('Suggested topics')).not.toBeInTheDocument();
  });
});
