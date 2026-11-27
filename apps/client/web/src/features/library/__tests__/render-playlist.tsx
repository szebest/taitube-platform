import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import type { HttpHandler } from 'msw/http';
import type { ReactElement } from 'react';
import { libraryVideo, playlistDetail, seriesDetail, uuid } from '#app/__tests__/library-fixtures';
import { signedIn, withToasts } from '#app/__tests__/providers';
import { renderLibrary } from './render-library';

export const LIST = uuid(4100);
export const VIDEOS = [
  libraryVideo(1, 'Tram ride'),
  libraryVideo(2, 'Old film'),
  libraryVideo(3, 'Night bus'),
];
export const ITEMS = [uuid(5000), uuid(5001), uuid(5002)];

/** The playlist page of `LIST`, owned by the viewer and holding `VIDEOS`, with `overrides` on the playlist and `handlers` first. */
export const renderPlaylist = (
  overrides: Parameters<typeof playlistDetail>[2] = {},
  handlers: HttpHandler[] = []
) =>
  renderLibrary(`/playlist?list=${LIST}`, {
    details: [playlistDetail(LIST, VIDEOS, { description: 'Slow ways home', ...overrides })],
    handlers,
  });

/** The same page for a series of `VIDEOS`, `progress` percent watched of each, continuing at the video numbered `next`. */
export const renderSeries = (progress: (number | null)[], next: number | null) =>
  renderLibrary(`/playlist?list=${LIST}`, {
    details: [seriesDetail(LIST, VIDEOS, progress, next === null ? null : uuid(next))],
  });

/** How long a `findBy` waits for a dialog whose body is a lazy chunk, loaded the first time it opens. */
export const LAZY = { timeout: 5000 };

/** Picks `item` from the hero's More menu. */
export async function chooseFromMore(user: UserEvent, item: string) {
  await user.click(await screen.findByRole('button', { name: 'More playlist actions' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

export const rowOf = async (title: string) => {
  const card = (await screen.findByRole('link', { name: title })).closest('article');
  if (!card) throw new Error(`no card around ${title}`);
  return within(card);
};

export const titles = () =>
  within(screen.getByRole('list', { name: 'Videos in Road trips' }))
    .getAllByRole('article')
    .map(
      (card) => within(card).getByRole('link', { name: /Tram ride|Old film|Night bus/ }).textContent
    );

/** `ui` alone, as the signed-in owner: under the app's providers, toasts and a router for its links, with `handlers` answering the API. */
export async function renderPart(
  ui: ReactElement,
  {
    handlers = [],
    client = createQueryClient(),
    url = '/',
  }: { handlers?: HttpHandler[]; client?: ReturnType<typeof createQueryClient>; url?: string } = {}
) {
  apiServer.use(...handlers);
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const Providers = withToasts(signedIn());
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  const rendered = render(
    <QueryClientProvider client={client}>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </QueryClientProvider>
  );
  return { ...rendered, client, router, user: userEvent.setup() };
}
