import { clientAppRequestMiddleware } from '@kit/security-headers';
import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { sessionMiddleware } from '../session-middleware';

const API = 'http://api.internal:3000';

const PAGE = { accept: 'text/html,application/xhtml+xml' };

type Answer = {
  cookie?: string;
  headers?: Record<string, string>;
  method?: string;
  handlerType?: 'router' | 'serverFn';
  /** What the API answers every call with; `{}` by default. */
  reply?: (authorization: string | null) => Response;
  refresh?: (refused: string) => Promise<string | undefined>;
  /** Runs the CSRF check every client app mounts first, as `src/start.ts` orders them. */
  behindCsrf?: boolean;
};

const [crossSiteWriteMiddleware] = clientAppRequestMiddleware;

async function answer(
  pathname: string,
  {
    cookie = '',
    headers = {},
    method = 'GET',
    handlerType = 'router',
    reply = () => HttpResponse.json({}),
    refresh,
    behindCsrf = false,
  }: Answer = {}
) {
  const bearers: (string | null)[] = [];
  apiServer.use(
    http.all(`${API}/*`, ({ request }) => {
      const authorization = request.headers.get('authorization');
      bearers.push(authorization);
      return reply(authorization);
    })
  );
  const next = vi.fn().mockResolvedValue({ response: new Response('page') });
  const request = new Request(`http://localhost:5173${pathname}`, {
    method,
    headers: { ...headers, cookie },
  });
  const middleware = sessionMiddleware({
    apiBaseUrl: API,
    cookieDomain: 'taitube.example',
    devTokenUrl: 'http://dev-token:3002',
    accountsMax: 4,
    refresh,
  });
  const session = () =>
    middleware.options.server?.({ request, pathname, context: undefined, handlerType, next });
  const csrfThenSession = async () => {
    const passed = vi.fn().mockImplementation(async () => {
      const result = await session();
      return { request, pathname, context: {}, response: result };
    });
    const result = await crossSiteWriteMiddleware?.options.server?.({
      request,
      pathname,
      context: undefined,
      handlerType,
      next: passed,
    });
    return result instanceof Response ? result : result?.response;
  };

  const answered: { result?: unknown } = {};
  const response = await requestHandler(async () => {
    answered.result = await (behindCsrf ? csrfThenSession() : session());
    return answered.result instanceof Response ? answered.result : new Response(null);
  })(request, {});

  const rendered = next.mock.results[0]?.value as Promise<{ response: Response }> | undefined;
  return {
    bearers,
    next,
    response,
    page: rendered && (await rendered).response,
    setCookies: response.headers.getSetCookie(),
  };
}

const TWO_SLOTS = 'vp.session.0=zero; vp.session.1=one';

describe('@vp/queries: session middleware', () => {
  it.each(['/api/v1/videos', '/api'])('answers %s from the API', async (pathname) => {
    const { bearers, next } = await answer(pathname);

    expect(bearers).toHaveLength(1);
    expect(next).not.toHaveBeenCalled();
  });

  it.each<{ call: string; path: string; headers: Record<string, string>; bearer: string }>([
    {
      call: 'naming slot 1',
      path: '/api/v1/me/account',
      headers: { 'x-account-slot': '1' },
      bearer: 'Bearer one',
    },
    {
      call: 'naming no slot, as the default',
      path: '/api/v1/me/account',
      headers: {},
      bearer: 'Bearer zero',
    },
    {
      call: 'of a stream under slot 1',
      path: '/u/1/api/v1/me/events',
      headers: {},
      bearer: 'Bearer one',
    },
  ])('sends a read $call with that slot token', async ({ path, headers, bearer }) => {
    const { bearers } = await answer(path, { cookie: TWO_SLOTS, headers });

    expect(bearers).toEqual([bearer]);
  });

  it('refuses a write that names no slot in X-Account-Slot', async () => {
    const { bearers, response } = await answer('/api/v1/videos/v1/reactions', {
      cookie: TWO_SLOTS,
      method: 'POST',
    });

    expect(response.status).toBe(403);
    expect(bearers).toEqual([]);
  });

  it.each(['/apiary', '/watch/abc', '/_serverFn/x'])(
    'renders %s, handing it the session settings',
    async (pathname) => {
      const { bearers, next } = await answer(pathname);

      expect(bearers).toEqual([]);
      expect(next).toHaveBeenCalledWith({
        context: {
          session: {
            apiBaseUrl: API,
            cookieDomain: 'taitube.example',
            devTokenUrl: 'http://dev-token:3002',
            accountsMax: 4,
          },
        },
      });
    }
  );

  it.each([
    {
      scenario: 'a page with no prefix, two accounts in',
      path: '/watch/abc?t=3',
      cookie: TWO_SLOTS,
      location: '/u/0/watch/abc?t=3',
    },
    {
      scenario: 'a page with no prefix, the default slot remembered',
      path: '/watch/abc',
      cookie: `${TWO_SLOTS}; vp.accounts=${encodeURIComponent(JSON.stringify({ defaultSlot: 1, slots: [] }))}`,
      location: '/u/1/watch/abc',
    },
    {
      scenario: 'a prefix for a slot with no session',
      path: '/u/3/watch/abc',
      cookie: TWO_SLOTS,
      location: '/login?slot=3&reason=expired&redirect=%2Fwatch%2Fabc',
    },
    {
      scenario: 'a page with no prefix, one account in',
      path: '/watch/abc',
      cookie: 'vp.session.0=zero',
      location: null,
    },
    { scenario: 'the sign-in page', path: '/login?slot=1', cookie: TWO_SLOTS, location: null },
    {
      scenario: 'a page under its own prefix',
      path: '/u/1/watch/abc',
      cookie: TWO_SLOTS,
      location: null,
    },
  ])('moves $scenario to $location', async ({ path, cookie, location }) => {
    const { response, next } = await answer(path, { cookie, headers: PAGE });

    expect(response.headers.get('location')).toBe(location);
    expect(response.status === 302).toBe(location !== null);
    expect(next).toHaveBeenCalledTimes(location === null ? 1 : 0);
  });

  it.each([
    {
      scenario: 'a feed fetched by a script',
      headers: { accept: 'application/xml' },
      handlerType: 'router' as const,
    },
    { scenario: 'a server function', headers: PAGE, handlerType: 'serverFn' as const },
  ])('never moves $scenario', async ({ headers, handlerType }) => {
    const { next } = await answer('/feeds/videos.xml', { cookie: TWO_SLOTS, headers, handlerType });

    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    { viewer: 'signed in', cookie: 'vp.session.0=zero', cacheControl: 'private, no-store' },
    { viewer: 'a guest', cookie: '', cacheControl: null },
  ])('marks a page for a viewer $viewer as $cacheControl', async ({ cookie, cacheControl }) => {
    const { page } = await answer('/watch/abc', { cookie, headers: PAGE });

    expect(page?.headers.get('cache-control')).toBe(cacheControl);
  });

  it.each<{ scenario: string; headers: Record<string, string>; status: number; bearers: string[] }>(
    [
      {
        scenario: 'a cross-site write naming its slot, refused by the CSRF check',
        headers: { 'sec-fetch-site': 'cross-site', 'x-account-slot': '1' },
        status: 403,
        bearers: [],
      },
      {
        scenario: 'a same-origin write naming no slot, refused by the proxy',
        headers: { 'sec-fetch-site': 'same-origin' },
        status: 403,
        bearers: [],
      },
      {
        scenario: 'a same-origin write naming its slot',
        headers: { 'sec-fetch-site': 'same-origin', 'x-account-slot': '1' },
        status: 200,
        bearers: ['Bearer one'],
      },
    ]
  )('answers $scenario with $status', async ({ headers, status, bearers: expected }) => {
    const { response, bearers } = await answer('/api/v1/videos/v1/reactions', {
      cookie: TWO_SLOTS,
      method: 'POST',
      headers,
      behindCsrf: true,
    });

    expect(response.status).toBe(status);
    expect(bearers).toEqual(expected);
  });

  it.each([
    {
      scenario: 'moving a browser signed in before slots',
      path: '/watch/abc',
      cookie: 'vp.session=legacy',
    },
    {
      scenario: 'refreshing a refused token',
      path: '/api/v1/me/account',
      cookie: TWO_SLOTS,
      refresh: async () => 'fresh',
    },
    {
      scenario: 'clearing a token with no refresh to be had',
      path: '/api/v1/me/account',
      cookie: TWO_SLOTS,
    },
  ])(
    'writes every slot cookie httpOnly, SameSite=Lax, on the shared domain, when $scenario',
    async ({ path, cookie, refresh }) => {
      const { setCookies } = await answer(path, {
        cookie,
        refresh,
        reply: (authorization) =>
          authorization === 'Bearer fresh'
            ? HttpResponse.json({})
            : HttpResponse.json({}, { status: 401 }),
      });
      const slotCookies = setCookies.filter((set) => set.startsWith('vp.session'));

      expect(slotCookies.length).toBeGreaterThan(0);
      for (const set of slotCookies) {
        expect(set).toMatch(/; HttpOnly(;|$)/);
        expect(set).toMatch(/; SameSite=Lax(;|$)/);
        expect(set).toMatch(/; Path=\/(;|$)/);
        expect(set).toMatch(/; Domain=taitube\.example(;|$)/);
      }
    }
  );

  it('moves a browser signed in before slots onto slot 0', async () => {
    const { setCookies } = await answer('/watch/abc', { cookie: 'vp.session=legacy' });

    expect(setCookies.map((set) => set.split(';')[0])).toEqual([
      'vp.session.0=legacy',
      'vp.session=',
    ]);
  });
});
