import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

import { apiProxyMiddleware, proxyToApi } from '../api-proxy';

const API = 'http://api.internal:3000';
const APP = 'http://localhost:5173';

type Sent = { url: string; method: string; headers: Headers; body: string };

/** The API behind the proxy: records what reached it and answers with `reply`. */
function api(reply: () => Response = () => HttpResponse.json({ ok: true })): Sent[] {
  const sent: Sent[] = [];
  apiServer.use(
    http.all(`${API}/*`, async ({ request }) => {
      sent.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.text(),
      });
      return reply();
    })
  );
  return sent;
}

/** A browser's call to the app's `/api`, answered the way the app's server answers it. */
function callProxy(path: string, init: RequestInit = {}, clientAddress?: string) {
  const request = Object.assign(new Request(`${APP}${path}`, init), { ip: clientAddress });
  return requestHandler(() => proxyToApi(request, API))(request, {});
}

describe('@vp/queries: the same-origin API proxy', () => {
  it('forwards the method, the path under /api, the query and the body, and relays the answer', async () => {
    const sent = api(() => HttpResponse.json({ id: 'v1' }, { status: 201 }));

    const answer = await callProxy('/api/v1/videos?limit=5', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Launch day' }),
    });

    expect(sent).toMatchObject([
      { url: `${API}/v1/videos?limit=5`, method: 'POST', body: '{"title":"Launch day"}' },
    ]);
    expect(answer.status).toBe(201);
    expect(await answer.json()).toEqual({ id: 'v1' });
  });

  it('tells the API the trace and the bearer, and never the cookies of this origin', async () => {
    const sent = api();

    await callProxy('/api/v1/videos', {
      headers: {
        authorization: 'Bearer stored',
        cookie: 'vp.theme=dark',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vp=1',
        'x-admin-token': 'guess',
      },
    });

    const headers = Object.fromEntries(sent[0]?.headers ?? []);
    expect(headers).toMatchObject({
      authorization: 'Bearer stored',
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

      await callProxy(
        '/api/v1/search?q=lofi',
        { headers: upstream ? { 'x-forwarded-for': upstream } : {} },
        '203.0.113.7'
      );

      expect(sent[0]?.headers.get('x-forwarded-for')).toBe(expected);
    }
  );

  it('keeps the cookies the API sets off this origin', async () => {
    api(() => HttpResponse.json({}, { headers: { 'set-cookie': 'api=1; Path=/' } }));

    const answer = await callProxy('/api/v1/videos');

    expect(answer.headers.get('set-cookie')).toBeNull();
  });

  it.each([
    { path: '/api/v1/videos', proxied: true },
    { path: '/api', proxied: true },
    { path: '/apiary', proxied: false },
    { path: '/watch/abc', proxied: false },
  ])('answers $path from the API: $proxied', async ({ path, proxied }) => {
    const sent = api();
    const next = vi.fn().mockResolvedValue({ response: new Response('page') });
    const request = new Request(`${APP}${path}`);

    await requestHandler(async () => {
      await apiProxyMiddleware(API).options.server?.({
        request,
        pathname: path,
        context: undefined,
        handlerType: 'router',
        next,
      });
      return new Response(null);
    })(request, {});

    expect(sent.length > 0).toBe(proxied);
    expect(next.mock.calls.length > 0).toBe(!proxied);
  });
});
