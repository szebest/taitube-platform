import { hashKey } from '@tanstack/react-query';
import { getShorts } from '@vp/api-contracts';
import { api, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { SHORTS } from '#app/features/shorts/__tests__/short-fixtures';
import { getRouter } from '#app/router';

describe('apps/client/web: /shorts', () => {
  it('server-renders the first Short with its actions, dehydrated so the browser does not ask again', async () => {
    const answered: string[] = [];
    const queryHash = hashKey(shortsFeedQueryOptions(api).queryKey);

    const { status, main, html } = await serverRender(getRouter, '/shorts', {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('Short 1');
    expect(main).toContain(`src="${SHORTS[0]?.posterUrl}"`);
    expect(main).toMatch(/aria-pressed="false"/);
    expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
    expect(answered).toEqual(['/v1/shorts']);
  });

  it('server-renders its empty state, with the way back to the home feed, when there are no Shorts', async () => {
    const { main } = await serverRender(getRouter, '/shorts', {
      handlers: [
        mockEndpoint(getShorts, () => HttpResponse.json({ items: [], nextCursor: null, total: 0 })),
      ],
    });

    expect(main).toContain('>Shorts will appear here</h1>');
    expect(main).toMatch(/<a[^>]*href="\/"[^>]*>Browse videos<\/a>/);
  });
});
