import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { api, apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

import { type AppRouterContext, createAppRouter } from '../../app-router';
import { DEV_TOKEN_URL } from '../persona-sign-in';
import { PersonaSwitcher } from '../persona-switcher';

async function renderSwitcher() {
  const routeTree = createRootRouteWithContext<AppRouterContext>()({
    component: () => (
      <IntlProvider locale="en" timeZone="UTC">
        <PersonaSwitcher />
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
    { api, history: createMemoryHistory({ initialEntries: ['/login'] }) }
  );
  const invalidate = vi.spyOn(router, 'invalidate');
  await router.load();
  render(<RouterProvider router={router} />);
  return { invalidate, user: userEvent.setup() };
}

function devTokenServe(reply: (persona: string | null) => Response) {
  apiServer.use(
    http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
      reply(new URL(request.url).searchParams.get('persona'))
    )
  );
}

describe('@vp/queries: PersonaSwitcher', () => {
  it.each(['User', 'Creator', 'Admin'])(
    'signs in as %s and loads the routes again as them',
    async (persona) => {
      devTokenServe((asked) => HttpResponse.json({ token: `token-of-${asked}` }));
      const { invalidate, user } = await renderSwitcher();

      await user.click(await screen.findByRole('button', { name: persona }));

      await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
      expect(document.cookie).toBe(`vp.session=token-of-${persona.toLowerCase()}`);
    }
  );

  it('signs out as Guest', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the browser arrives signed in.
    document.cookie = 'vp.session=token-of-admin; path=/';
    const { invalidate, user } = await renderSwitcher();

    await user.click(await screen.findByRole('button', { name: 'Guest' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(document.cookie).toBe('');
  });

  it('says why when dev-token serve is not answering, and signs no one in', async () => {
    devTokenServe(() => new HttpResponse(null, { status: 404 }));
    const { invalidate, user } = await renderSwitcher();

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Is pnpm dev running dev-token serve?'
    );
    expect(invalidate).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });
});
