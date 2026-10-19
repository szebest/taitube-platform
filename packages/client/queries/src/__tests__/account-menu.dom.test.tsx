import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { account, api } from '@vp/web-testing';

import { AccountMenu } from '../account-menu';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { GUEST, type Session } from '../session';
import { SessionProvider } from '../session-provider';

async function renderMenu(session: Session) {
  const routeTree = createRootRouteWithContext<AppRouterContext>()({
    component: () => (
      <IntlProvider locale="en" timeZone="UTC">
        <SessionProvider session={session}>
          <AccountMenu studioUrl="http://studio.test" />
        </SessionProvider>
      </IntlProvider>
    ),
  });
  const router = createAppRouter(
    {
      routeTree,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
      error: () => null,
      notFound: () => null,
    },
    { api, history: createMemoryHistory({ initialEntries: ['/watch/abc?t=12'] }) }
  );
  const invalidate = vi.spyOn(router, 'invalidate');
  await router.load();
  render(<RouterProvider router={router} />);
  return { invalidate, user: userEvent.setup() };
}

describe('@vp/queries: AccountMenu', () => {
  it('offers a guest to sign in, and to come back here after', async () => {
    await renderMenu(GUEST);

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fwatch%2Fabc%3Ft%3D12'
    );
  });

  it("names a signed-in viewer's channel and links the studio's upload page", async () => {
    await renderMenu({ status: 'signed-in', account: account() });

    const menu = await screen.findByRole('navigation', { name: 'Account' });
    expect(menu).toHaveTextContent('The Creator');
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      'http://studio.test/upload'
    );
  });

  it('signs out on both apps, and loads the routes again as a guest, with no reload', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the browser arrives signed in.
    document.cookie = 'vp.session=signed-in; path=/';
    const { invalidate, user } = await renderMenu({ status: 'signed-in', account: account() });

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(document.cookie).toBe('');
  });
});
