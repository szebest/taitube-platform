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
  it('links to the sign-in page, and back to the page it was pressed on', async () => {
    await renderAt('/feed/trending?tab=new');

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Ffeed%2Ftrending%3Ftab%3Dnew'
    );
  });
});
