import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';

import { AppWords } from '../app-words';
import { RouteError, RouteNotFound } from '../route-errors';

function renderRoute(error: unknown) {
  const root = createRootRoute({
    component: () => (
      <nav>
        <Outlet />
      </nav>
    ),
  });
  const failing = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => {
      throw error;
    },
    errorComponent: RouteError,
  });
  const router = createRouter({
    routeTree: root.addChildren([failing]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultNotFoundComponent: RouteNotFound,
    Wrap: AppWords,
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(<RouterProvider router={router} />);
}

describe('@vp/queries: route error pages', () => {
  it.each([
    {
      error: new ApiError(404, ErrorCodes.VIDEO_NOT_FOUND, ''),
      title: 'Page not found',
      retry: false,
    },
    {
      error: new ApiError(403, ErrorCodes.FORBIDDEN, ''),
      title: 'You do not have access to this',
      retry: false,
    },
    {
      error: new ApiError(401, ErrorCodes.UNAUTHORIZED, ''),
      title: 'Sign in to continue',
      retry: false,
    },
    {
      error: new ApiError(429, ErrorCodes.RATE_LIMITED, ''),
      title: 'Slow down for a moment',
      retry: true,
    },
    {
      error: new ApiError(503, ErrorCodes.DATABASE_UNAVAILABLE, ''),
      title: 'Something went wrong on our side',
      retry: true,
    },
    { error: new Error('boom'), title: 'Something went wrong on our side', retry: true },
  ])('renders "$title" for $error.message', async ({ error, title, retry }) => {
    renderRoute(error);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(screen.queryByRole('button', { name: 'Try again' }) !== null).toBe(retry);
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('keeps the shell around the page and offers the way home', async () => {
    renderRoute(new ApiError(403, ErrorCodes.FORBIDDEN, ''));

    expect(await screen.findByRole('navigation')).toContainElement(
      screen.getByRole('link', { name: 'Go to the home page' })
    );
  });
});
