import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { api } from '@vp/web-testing';

import { type AppRouterContext, createAppRouter } from '../app-router';
import { useSignOut } from '../use-sign-out';

function SignOutButton() {
  const signOut = useSignOut();

  return (
    <button type="button" onClick={signOut}>
      Sign out
    </button>
  );
}

async function renderSignOut() {
  const routeTree = createRootRouteWithContext<AppRouterContext>()({ component: SignOutButton });
  const router = createAppRouter(
    {
      routeTree,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
    },
    { api, history: createMemoryHistory({ initialEntries: ['/'] }) }
  );
  const invalidate = vi.spyOn(router, 'invalidate');
  await router.load();
  render(<RouterProvider router={router} />);
  return { invalidate, user: userEvent.setup() };
}

describe('@vp/queries: useSignOut', () => {
  it('signs out on both apps, and loads the routes again as a guest, with no reload', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the browser arrives signed in.
    document.cookie = 'vp.session=signed-in; path=/';
    const { invalidate, user } = await renderSignOut();

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(document.cookie).toBe('');
  });
});
