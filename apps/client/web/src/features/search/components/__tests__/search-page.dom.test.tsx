import { screen } from '@testing-library/react';
import { search } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const renderSearch = (handlers = loaderApi()) =>
  renderRoute(getRouter, '/search?q=lofi', { handlers });

describe('apps/client/web: search page in the browser', () => {
  it('links each video the loader found to its watch page, without asking again', async () => {
    const answered: string[] = [];

    const { router, user } = await renderSearch(loaderApi(answered));
    await user.click(await screen.findByRole('link', { name: 'Search hit' }));

    expect(router.state.location.pathname).toMatch(/^\/watch\//);
    expect(answered.filter((path) => path === '/v1/search')).toHaveLength(1);
  });

  it('says so when nothing matches', async () => {
    await renderSearch([
      mockEndpoint(search, () =>
        HttpResponse.json({
          items: [],
          nextCursor: null,
          tookMs: 1,
          total: 0,
          fuzzyFallback: false,
        })
      ),
    ]);

    expect(await screen.findByText('No videos match lofi')).toBeInTheDocument();
  });
});
