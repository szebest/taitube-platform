import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  type RouterHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { createApiClient } from '@vp/api-client';
import { getFeed, getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw/http';

import { VIDEO_ID, videoSummary } from '../fixtures';
import { createEndpointMocks, problemReply } from '../mock-endpoint';
import { renderRoute } from '../render-route';

const BASE_URL = 'http://localhost:3000';
const { mockEndpoint } = createEndpointMocks(BASE_URL);
const api = createApiClient({ baseUrl: BASE_URL });

const feedQuery = { queryKey: ['feed'], queryFn: () => api.feed.getFeed() };
const videoQuery = (id: string) => ({
  queryKey: ['video', id],
  queryFn: () => api.videos.getVideo({ params: { id } }),
});

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <html lang="en">
      <body>
        <Outlet />
      </body>
    </html>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(feedQuery),
  component: function Home() {
    const { data } = useSuspenseQuery(feedQuery);
    return data.items.map((item) => <p key={item.id}>{item.title}</p>);
  },
});

const videoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/videos/$videoId',
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(videoQuery(params.videoId)),
  component: () => <p>video</p>,
});

function getRouter({ history }: { history: RouterHistory }) {
  const queryClient = new QueryClient();
  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, videoRoute]),
    history,
    context: { queryClient },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    defaultErrorComponent: () => <p role="alert">There was an error while loading the page</p>,
    defaultNotFoundComponent: () => (
      <div role="alert">
        <p>This page does not exist.</p>
        <Link to="/">Go to the home page</Link>
      </div>
    ),
  });
}

describe('@vp/web-testing: renderRoute', () => {
  it('opens the url in the route tree the app builds, with its fallbacks', async () => {
    const { router } = await renderRoute(getRouter, '/no-such-page');

    expect(router.state.location.pathname).toBe('/no-such-page');
    expect(screen.getByRole('alert')).toHaveTextContent('This page does not exist.');
  });

  it('starts from an empty page, whatever the test before it rendered', () => {
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks the API once for a query that fails, without retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let asked = 0;
    const failing = mockEndpoint(getVideo, () => {
      asked += 1;
      return problemReply(ErrorCodes.INTERNAL);
    });

    await renderRoute(getRouter, `/videos/${VIDEO_ID}`, { handlers: [failing] });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it('renders a live page a user can click through', async () => {
    const homePage = mockEndpoint(getFeed, () =>
      HttpResponse.json({ items: [videoSummary({ title: 'Fresh' })], nextCursor: null, total: 1 })
    );
    const { router, user } = await renderRoute(getRouter, '/no-such-page', {
      handlers: [homePage],
    });

    await user.click(screen.getByRole('link', { name: 'Go to the home page' }));

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
