import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { z } from 'zod';

import { useSignIn } from '../use-sign-in';

function SignInButton() {
  const signIn = useSignIn();

  return (
    <button type="button" onClick={signIn}>
      Sign in
    </button>
  );
}

function renderSignInAt(url: string) {
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: '/shorts',
    component: SignInButton,
  });
  const login = createRoute({
    getParentRoute: () => root,
    path: '/login',
    validateSearch: z.object({ redirect: z.string() }),
  });
  const router = createRouter({
    routeTree: root.addChildren([page, login]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('apps/client/web: useSignIn', () => {
  it('sends the guest to /login, with the page they pressed on as the way back', async () => {
    const router = renderSignInAt('/shorts?from=home');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: '/shorts?from=home' });
  });
});
