import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { proxyToApi } from '../api-proxy';
import type { RefreshSession } from '../session-config';

const API = 'http://api.internal:3000';
const APP = 'http://localhost:5173';
const BODY_LIMIT_BYTES = 1_048_576;

type Sent = { url: string; method: string; headers: Headers; body: string };

/** The API behind the proxy: records what reached it and answers each call with the next reply. */
function api(...replies: (() => Response)[]): Sent[] {
  const sent: Sent[] = [];
  apiServer.use(
    http.all(`${API}/*`, async ({ request }) => {
      sent.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.text(),
      });
      return (replies[sent.length - 1] ?? (() => HttpResponse.json({ ok: true })))();
    })
  );
  return sent;
}

const refused = () => HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

type Call = {
  init?: RequestInit;
  clientAddress?: string;
  refresh?: RefreshSession;
  onRequest?: (request: Request) => void;
  /** The slot the call names; `null` for a call that names none. */
  slot?: number | null;
};

/** A browser's call to the app's `/api`, answered the way the app's server answers it. */
function callProxy(
  path: string,
  { init = {}, clientAddress, refresh, onRequest, slot = 0 }: Call = {}
) {
  const request = Object.assign(new Request(`${APP}${path}`, init), { ip: clientAddress });
  onRequest?.(request);
  const named = { pathname: new URL(request.url).pathname, slot: slot ?? undefined };
  return requestHandler(() => proxyToApi(request, { apiBaseUrl: API, refresh }, named))(
    request,
    {}
  );
}

const cookieNames = (answer: Response) =>
  answer.headers.getSetCookie().map((set) => set.split(';')[0]);

describe('@vp/queries: the same-origin API proxy', () => {
  it('forwards the method, the path under /api, the query and the body, and relays the answer', async () => {
    const sent = api(() => HttpResponse.json({ id: 'v1' }, { status: 201 }));

    const answer = await callProxy('/api/v1/videos?limit=5', {
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Launch day' }),
      },
    });

    expect(sent).toMatchObject([
      { url: `${API}/v1/videos?limit=5`, method: 'POST', body: '{"title":"Launch day"}' },
    ]);
    expect(answer.status).toBe(201);
    expect(await answer.json()).toEqual({ id: 'v1' });
  });

  it("tells the API the session cookie's token and the trace, and none of the browser's own credentials", async () => {
    const sent = api();

    await callProxy('/api/v1/videos', {
      init: {
        headers: {
          cookie: 'vp.session=t0ken; vp.theme=dark',
          authorization: 'Bearer forged',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          tracestate: 'vp=1',
          'x-admin-token': 'guess',
        },
      },
    });

    const headers = Object.fromEntries(sent[0]?.headers ?? []);
    expect(headers).toMatchObject({
      authorization: 'Bearer t0ken',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vp=1',
    });
    expect(headers).not.toHaveProperty('cookie');
    expect(headers).not.toHaveProperty('x-admin-token');
  });

  it.each([
    { slot: 0, authorization: 'Bearer zero' },
    { slot: 1, authorization: 'Bearer one' },
    { slot: 2, authorization: null },
  ])("sends slot $slot's token alone as the bearer", async ({ slot, authorization }) => {
    const sent = api();

    await callProxy('/api/v1/me/account', {
      init: { headers: { cookie: 'vp.session.0=zero; vp.session.1=one' } },
      slot,
    });

    expect(sent[0]?.headers.get('authorization')).toBe(authorization);
  });

  it('refuses a write that names no slot, which a cross-site form cannot', async () => {
    const sent = api();

    const answer = await callProxy('/api/v1/videos/v1/reactions', {
      init: { method: 'POST', headers: { cookie: 'vp.session.0=zero' } },
      slot: null,
    });

    expect(answer.status).toBe(403);
    expect(await answer.json()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(sent).toEqual([]);
  });

  it('forwards the channel the studio acts on, for the API to check against the memberships', async () => {
    const sent = api();

    await callProxy('/api/v1/me/channel/members', {
      init: { headers: { 'x-channel-id': '00000000-0000-7000-8000-0000000000c1' } },
    });

    expect(sent[0]?.headers.get('x-channel-id')).toBe('00000000-0000-7000-8000-0000000000c1');
  });

  it.each([
    { hops: 'no proxy before it', upstream: undefined, expected: '203.0.113.7' },
    {
      hops: 'an ingress before it',
      upstream: '198.51.100.2',
      expected: '198.51.100.2, 203.0.113.7',
    },
  ])(
    'adds the browser it answers to X-Forwarded-For, behind $hops',
    async ({ upstream, expected }) => {
      const sent = api();

      await callProxy('/api/v1/search?q=lofi', {
        init: { headers: upstream ? { 'x-forwarded-for': upstream } : {} },
        clientAddress: '203.0.113.7',
      });

      expect(sent[0]?.headers.get('x-forwarded-for')).toBe(expected);
    }
  );

  it.each([
    { apiVary: 'Authorization', vary: 'Authorization, x-account-slot, x-channel-id' },
    { apiVary: null, vary: 'x-account-slot, x-channel-id' },
    { apiVary: '*', vary: '*' },
  ])(
    'varies an answer whose API Vary is $apiVary on the slot and channel the browser named',
    async ({ apiVary, vary }) => {
      api(() =>
        HttpResponse.json(
          {},
          {
            headers: {
              'cache-control': 'private, max-age=30',
              ...(apiVary ? { vary: apiVary } : {}),
            },
          }
        )
      );

      const answer = await callProxy('/api/v1/feed');

      expect(answer.headers.get('vary')).toBe(vary);
    }
  );

  it('keeps the cookies the API sets off this origin', async () => {
    api(() => HttpResponse.json({}, { headers: { 'set-cookie': 'api=1; Path=/' } }));

    const answer = await callProxy('/api/v1/videos');

    expect(answer.headers.get('set-cookie')).toBeNull();
  });

  it('refreshes a token the API refused once, and retries the call with the fresh one', async () => {
    const sent = api(refused, () => HttpResponse.json({ id: 'v1' }));
    const refresh = vi.fn(async () => 'fresh');

    const answer = await callProxy('/api/v1/videos', {
      init: { method: 'DELETE', headers: { cookie: 'vp.session.0=other; vp.session.1=stale' } },
      refresh,
      slot: 1,
    });

    expect(sent.map(({ method, headers }) => [method, headers.get('authorization')])).toEqual([
      ['DELETE', 'Bearer stale'],
      ['DELETE', 'Bearer fresh'],
    ]);
    expect(refresh).toHaveBeenCalledExactlyOnceWith('stale');
    expect(answer.status).toBe(200);
    expect(cookieNames(answer)).toEqual(['vp.session.1=fresh']);
  });

  it('clears the one slot the API refused when there is no refresh to be had, marks it expired, and passes the 401 on', async () => {
    const sent = api(refused);
    const accounts = {
      defaultSlot: 1,
      slots: [0, 1].map((slot) => ({
        slot,
        userId: `user-${slot}`,
        label: `Account ${slot}`,
        avatarUrl: null,
        channel: null,
        expired: false,
      })),
    };

    const answer = await callProxy('/api/v1/me/account', {
      init: {
        headers: {
          cookie: `vp.session.0=valid; vp.session.1=stale; vp.accounts=${encodeURIComponent(JSON.stringify(accounts))}`,
        },
      },
      slot: 1,
    });

    expect(sent).toHaveLength(1);
    expect(answer.status).toBe(401);
    expect(answer.headers.getSetCookie()).toHaveLength(2);
    const [cleared, marked] = answer.headers.getSetCookie();
    expect(cleared).toMatch(/^vp\.session\.1=; Max-Age=0;/);
    const written = JSON.parse(
      decodeURIComponent(marked?.split(';')[0]?.slice('vp.accounts='.length) ?? '')
    );
    expect(written.slots.map(({ expired }: { expired: boolean }) => expired)).toEqual([
      false,
      true,
    ]);
  });

  it("passes a guest's 401 on and leaves the cookies alone", async () => {
    api(refused);
    const refresh = vi.fn(async () => 'fresh');

    const answer = await callProxy('/api/v1/me/account', { refresh });

    expect(answer.status).toBe(401);
    expect(answer.headers.getSetCookie()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    {
      framing: 'by the length it declares, before reading it',
      init: {
        method: 'POST',
        headers: { 'content-length': String(BODY_LIMIT_BYTES + 1) },
        body: 'x',
      },
      bodyRead: false,
    },
    {
      framing: 'as it grows past the limit, chunk by chunk',
      init: {
        method: 'POST',
        body: new Blob(['x'.repeat(BODY_LIMIT_BYTES), 'x']).stream(),
        duplex: 'half',
      },
      bodyRead: true,
    },
  ])("refuses a body over the API's limit $framing", async ({ init, bodyRead }) => {
    const sent = api();
    let request: Request | undefined;

    const answer = await callProxy('/api/v1/uploads', {
      init,
      onRequest: (received) => {
        request = received;
      },
    });

    expect(request?.bodyUsed).toBe(bodyRead);
    expect(answer.status).toBe(413);
    expect(await answer.json()).toMatchObject({ code: 'VALIDATION_FAILED', status: 413 });
    expect(sent).toEqual([]);
  });
});
