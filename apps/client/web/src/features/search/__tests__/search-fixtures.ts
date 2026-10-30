import { screen, within } from '@testing-library/react';
import type { SearchResultItem } from '@vp/api-contracts';
import { renderRoute } from '@vp/web-testing/dom';
import type { HttpHandler } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

import { page, searchReply, suggestionsReply } from './search-replies';

export * from './search-replies';

/** The search suite's one way to open a route: the real router, the loader fixtures behind `handlers`. */
export async function renderSearch(url: string, handlers: HttpHandler[] = [], signedIn = false) {
  const extra = signedIn ? [signInBrowser()] : [];
  return renderRoute(getRouter, url, { handlers: [...handlers, ...extra, ...loaderApi()] });
}

/** Opens the results page of `query` over `items` and answers the rows of its list. */
export async function renderResultRows(
  query: string,
  items: SearchResultItem[],
  type: 'all' | 'video' | 'channel' | 'playlist' = 'all'
) {
  const rendered = await renderSearch(`/search?q=${encodeURIComponent(query)}&type=${type}`, [
    searchReply(() => page(items)),
  ]);
  const list = await screen.findByRole('list', { name: `Results for ${query}` });
  return { ...rendered, rows: within(list) };
}

export async function openPalette(url = '/', handlers: HttpHandler[] = [], signedIn = false) {
  const rendered = await renderSearch(url, [...handlers, suggestionsReply([])], signedIn);
  await rendered.user.keyboard('/');
  return { ...rendered, field: await screen.findByRole('combobox') };
}
