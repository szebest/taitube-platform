import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { api } from '@vp/web-testing';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { SignInButton } from '../sign-in-button';

async function renderAt(path: string) {
  const routeTree = createRootRouteWithContext<AppRouterContext>()({ component: SignInButton });
  const router = createAppRouter(
    { routeTree, apiBaseUrl: 'http://localhost:3000', pending: () => null },
    { api, history: createMemoryHistory({ initialEntries: [path] }) }
  );
  await router.load();
  render(<RouterProvider router={router} />);
}

describe('@vp/queries: SignInButton', () => {
  it.each([
    {
      scenario: 'links to the sign-in page, and back to the page it was pressed on',
      path: '/feed/trending?tab=new',
      href: '/login?redirect=%2Ffeed%2Ftrending%3Ftab%3Dnew',
    },
    {
      scenario: 'keeps the way back the sign-in page already has, not nesting it',
      path: '/login?redirect=%2Fwatch%2F1',
      href: '/login?redirect=%2Fwatch%2F1',
    },
    { scenario: 'adds no way back on a bare sign-in page', path: '/login', href: '/login' },
  ])('$scenario', async ({ path, href }) => {
    await renderAt(path);

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', href);
  });
});
