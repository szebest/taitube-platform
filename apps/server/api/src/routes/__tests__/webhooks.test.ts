import { ErrorCodes } from '@vp/errors';
import { buildLibraryApp, type LibraryApp } from '../../__tests__/library-app';

const BODY = { url: 'https://hooks.example.com/in', events: ['video.ready'] };

describe('webhook routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const create = (who: 'owner' | 'stranger' | 'anonymous', body: Record<string, unknown> = BODY) =>
    ctx.call(who, 'POST', '/v1/me/webhooks', body);

  it('registers a webhook and shows its secret once', async () => {
    const res = await create('owner');

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ...BODY, secret: expect.stringMatching(/^[0-9a-f]{64}$/) });

    const listed = await ctx.call('owner', 'GET', '/v1/me/webhooks');
    expect(listed.json().items).toEqual([
      { id: res.json().id, url: BODY.url, events: BODY.events, createdAt: expect.any(String) },
    ]);
  });

  it.each([
    { scenario: 'a guest', who: 'anonymous' as const, body: BODY, status: 401 },
    {
      scenario: 'a plain http url',
      who: 'owner' as const,
      body: { ...BODY, url: 'http://hooks.example.com/in' },
      status: 422,
    },
    {
      scenario: 'a private host',
      who: 'owner' as const,
      body: { ...BODY, url: 'https://10.0.0.5/in' },
      status: 422,
    },
    { scenario: 'no events', who: 'owner' as const, body: { ...BODY, events: [] }, status: 400 },
  ])('refuses $scenario with $status', async ({ who, body, status }) => {
    expect((await create(who, body)).statusCode).toBe(status);
  });

  it('refuses the eleventh webhook', async () => {
    for (let index = 0; index < 10; index += 1) await create('owner');

    const res = await create('owner');

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: ErrorCodes.WEBHOOK_LIMIT_REACHED });
  });

  it('lists only the caller webhooks', async () => {
    await create('owner');

    const res = await ctx.call('stranger', 'GET', '/v1/me/webhooks');

    expect(res.json()).toEqual({ items: [] });
  });

  it('removes the caller webhook and answers 404 for another user', async () => {
    const { id } = (await create('owner')).json();

    expect((await ctx.call('stranger', 'DELETE', `/v1/me/webhooks/${id}`)).statusCode).toBe(404);
    expect((await ctx.call('owner', 'DELETE', `/v1/me/webhooks/${id}`)).statusCode).toBe(204);
    expect((await ctx.call('owner', 'DELETE', `/v1/me/webhooks/${id}`)).json()).toMatchObject({
      code: ErrorCodes.WEBHOOK_NOT_FOUND,
    });
  });
});
