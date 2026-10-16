import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

import { proxyToApi } from '../api-proxy';
import type { RefreshSession } from '../session-config';

const API = 'http://api.internal:3000';
const APP = 'http://localhost:5173';

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

type Call = { init?: RequestInit; clientAddress?: string; refresh?: RefreshSession };

/** A browser's call to the app's `/api`, answered the way the app's server answers it. */
function callProxy(path: string, { init = {}, clientAddress, refresh }: Call = {}) {
  const request = Object.assign(new Request(`${APP}${path}`, init), { ip: clientAddress });
  return requestHandler(() => proxyToApi(request, { apiBaseUrl: API, refresh }))(request, {});
}

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

  it('keeps the cookies the API sets off this origin', async () => {
    api(() => HttpResponse.json({}, { headers: { 'set-cookie': 'api=1; Path=/' } }));

    const answer = await callProxy('/api/v1/videos');

    expect(answer.headers.get('set-cookie')).toBeNull();
  });

  it('refreshes a token the API refused once, and retries the call with the fresh one', async () => {
    const sent = api(refused, () => HttpResponse.json({ id: 'v1' }));
    const refresh = vi.fn(async () => 'fresh');

    const answer = await callProxy('/api/v1/videos', {
      init: { method: 'DELETE', headers: { cookie: 'vp.session=stale' } },
      refresh,
    });

    expect(sent.map(({ method, headers }) => [method, headers.get('authorization')])).toEqual([
      ['DELETE', 'Bearer stale'],
      ['DELETE', 'Bearer fresh'],
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(answer.status).toBe(200);
    expect(answer.headers.getSetCookie()).toEqual([expect.stringMatching(/^vp\.session=fresh;/)]);
  });

  it('clears a session the API refused when there is no refresh to be had, and passes the 401 on', async () => {
    const sent = api(refused);

    const answer = await callProxy('/api/v1/me/account', {
      init: { headers: { cookie: 'vp.session=stale' } },
    });

    expect(sent).toHaveLength(1);
    expect(answer.status).toBe(401);
    expect(answer.headers.getSetCookie()).toEqual([
      expect.stringMatching(/^vp\.session=; Max-Age=0;/),
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
});
