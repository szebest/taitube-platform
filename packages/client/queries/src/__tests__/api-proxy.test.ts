import { HttpResponse } from 'msw/http';
import { API, api, APP, BODY_LIMIT_BYTES, callProxy, VIDEO } from './api-proxy-fixtures';

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

  it.each([
    { header: 'x-channel-id', value: '00000000-0000-7000-8000-0000000000c1' },
    { header: 'x-viewer-session', value: '0190c3a0-5e1d-7000-8000-0000000000f1' },
  ])('forwards $header, for the API to decide by', async ({ header, value }) => {
    const sent = api();

    await callProxy('/api/v1/videos', { init: { headers: { [header]: value } } });

    expect(sent[0]?.headers.get(header)).toBe(value);
  });

  it("tells the API the browser's video unlocks, and no other cookie", async () => {
    const sent = api();

    await callProxy(`/api/v1/videos/${VIDEO}`, {
      init: {
        headers: { cookie: `vp.session=t0ken; vp.video-access.${VIDEO}=signed; vp.theme=dark` },
      },
    });

    expect(sent[0]?.headers.get('cookie')).toBe(`vp.video-access.${VIDEO}=signed`);
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

  it.each([
    {
      where: 'locally',
      app: APP,
      unlock: `vp.video-access.${VIDEO}=signed; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`,
    },
    {
      where: 'on a real host',
      app: 'https://taitube.example',
      unlock: `vp.video-access.${VIDEO}=signed; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  ])(
    "sets the API's video unlock on this origin $where, for the time it was given, and nothing else",
    async ({ app, unlock }) => {
      api(() => {
        const headers = new Headers();
        headers.append(
          'set-cookie',
          `vp.video-access.${VIDEO}=signed; Max-Age=43200; Domain=api.internal; Path=/v1; HttpOnly; SameSite=Strict`
        );
        headers.append('set-cookie', 'api=1; Path=/');
        return new HttpResponse(null, { status: 204, headers });
      });

      const answer = await callProxy(`/api/v1/videos/${VIDEO}/unlock`, {
        app,
        init: { method: 'POST', body: '{"password":"hunter22"}' },
      });

      expect(answer.status).toBe(204);
      expect(answer.headers.getSetCookie()).toEqual([unlock]);
    }
  );

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
