import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { getAccount, recordMySignIn } from '@vp/api-contracts';
import { account, api, apiServer, mockEndpoint, signInRecord } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { SPEC_MESSAGES } from '../../__tests__/spec-messages';
import { type AppRouterContext, createAppRouter } from '../../app-router';
import { IntlProvider } from '../../intl';
import { DEV_TOKEN_URL } from '../persona-sign-in';
import { PersonaSwitcher, type PersonaSwitcherProps } from '../persona-switcher';

async function renderSwitcher(props: PersonaSwitcherProps = {}, url = '/login') {
  const routeTree = createRootRouteWithContext<AppRouterContext>()({
    component: () => (
      <IntlProvider messages={SPEC_MESSAGES} locale="en" timeZone="UTC">
        <PersonaSwitcher {...props} />
      </IntlProvider>
    ),
  });
  const router = createAppRouter(
    {
      routeTree,
      messages: SPEC_MESSAGES,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
    },
    { api, history: createMemoryHistory({ initialEntries: [url] }) }
  );
  const invalidate = vi.spyOn(router, 'invalidate');
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, invalidate, user: userEvent.setup() };
}

function devTokenServe(reply: (persona: string | null) => Response) {
  apiServer.use(
    http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
      reply(new URL(request.url).searchParams.get('persona'))
    ),
    mockEndpoint(getAccount, () => HttpResponse.json(account())),
    mockEndpoint(recordMySignIn, () => HttpResponse.json(signInRecord(), { status: 201 }))
  );
}

const sessionCookies = () =>
  document.cookie.split('; ').filter((cookie) => cookie.startsWith('vp.session'));

describe('@vp/queries: PersonaSwitcher', () => {
  it.each([
    { button: 'Viewer', persona: 'user' },
    { button: 'Creator', persona: 'creator' },
    { button: 'Second creator', persona: 'creator2' },
    { button: 'Moderator', persona: 'moderator' },
    { button: 'Admin', persona: 'admin' },
  ])('signs in as the $button and loads the routes again as them', async ({ button, persona }) => {
    devTokenServe((asked) => HttpResponse.json({ token: `token-of-${asked}` }));
    const { invalidate, user } = await renderSwitcher();

    await user.click(await screen.findByRole('button', { name: button }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(sessionCookies()).toEqual([`vp.session.0=token-of-${persona}`]);
  });

  it('replaces the account signed in on this tab slot with the persona picked', async () => {
    // oxlint-disable-next-line unicorn/no-document-cookie -- the browser arrives signed in.
    document.cookie = 'vp.session.0=token-of-user; path=/';
    devTokenServe((asked) => HttpResponse.json({ token: `token-of-${asked}` }));
    const { invalidate, user } = await renderSwitcher();

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(sessionCookies()).toEqual(['vp.session.0=token-of-creator']);
  });

  it('adds a persona beside the account signed in, into the next slot, and moves the tab to it', async () => {
    devTokenServe((asked) => HttpResponse.json({ token: `token-of-${asked}` }));
    // oxlint-disable-next-line unicorn/no-document-cookie -- the browser arrives signed in.
    document.cookie = 'vp.session.0=token-of-someone; path=/';
    const { router, user } = await renderSwitcher({ adding: true, redirect: '/' });

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    await vi.waitFor(() => expect(router.history.location.pathname).toBe('/u/1'));
    expect(sessionCookies()).toEqual([
      'vp.session.0=token-of-someone',
      'vp.session.1=token-of-creator',
    ]);
    expect(screen.queryByRole('button', { name: 'Guest' })).toBeNull();
  });

  it('says why an add past the most accounts a browser holds is refused', async () => {
    devTokenServe((asked) => HttpResponse.json({ token: `token-of-${asked}` }));
    for (let slot = 0; slot < 10; slot += 1) {
      // oxlint-disable-next-line unicorn/no-document-cookie -- a browser holding every slot.
      document.cookie = `vp.session.${slot}=t${slot}; path=/`;
    }
    const onFailed = vi.fn();
    const { user } = await renderSwitcher({ adding: true, onFailed });

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    await vi.waitFor(() =>
      expect(onFailed).toHaveBeenCalledWith(
        'This browser holds as many accounts as it can. Sign one out first.'
      )
    );
  });

  it('signs out as Guest', async () => {
    // oxlint-disable-next-line unicorn/no-document-cookie -- the browser arrives signed in.
    document.cookie = 'vp.session.0=token-of-admin; path=/';
    const { invalidate, user } = await renderSwitcher();

    await user.click(await screen.findByRole('button', { name: 'Guest' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(sessionCookies()).toEqual([]);
  });

  it('says why when dev-token serve is not answering, and signs no one in', async () => {
    devTokenServe(() => new HttpResponse(null, { status: 404 }));
    const onAttempt = vi.fn();
    const onFailed = vi.fn();
    const { invalidate, user } = await renderSwitcher({ onAttempt, onFailed });

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    await vi.waitFor(() => expect(onFailed).toHaveBeenCalledOnce());
    expect(onFailed).toHaveBeenCalledWith(
      'That persona could not sign in. Is dev-token serve running?'
    );
    expect(onAttempt).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
    expect(sessionCookies()).toEqual([]);
  });
});
