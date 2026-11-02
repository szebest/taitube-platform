import { createWebhook, deleteWebhook, listWebhooks } from '../webhooks';

describe('packages/api-contracts: webhooks', () => {
  it.each([
    { endpoint: createWebhook, method: 'POST', path: '/v1/me/webhooks', status: 201 },
    { endpoint: listWebhooks, method: 'GET', path: '/v1/me/webhooks', status: 200 },
    { endpoint: deleteWebhook, method: 'DELETE', path: '/v1/me/webhooks/:id', status: 204 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { scenario: 'one event', body: { url: 'https://x.test/h', events: ['video.ready'] }, ok: true },
    {
      scenario: 'both events',
      body: { url: 'https://x.test/h', events: ['video.ready', 'live.started'] },
      ok: true,
    },
    { scenario: 'no events', body: { url: 'https://x.test/h', events: [] }, ok: false },
    {
      scenario: 'a reserved event',
      body: { url: 'https://x.test/h', events: ['video.milestone'] },
      ok: false,
    },
    { scenario: 'no url', body: { events: ['video.ready'] }, ok: false },
    {
      scenario: 'a very long url',
      body: { url: `https://x.test/${'a'.repeat(2100)}`, events: ['video.ready'] },
      ok: false,
    },
    {
      scenario: 'more events than exist',
      body: { url: 'https://x.test/h', events: ['video.ready', 'live.started', 'video.ready'] },
      ok: false,
    },
  ])('checks the create body of $scenario', ({ body, ok }) => {
    expect(createWebhook.body.safeParse(body).success).toBe(ok);
  });

  it('shows the secret on the created webhook only', () => {
    const view = {
      id: '00000000-0000-7000-8000-00000000000a',
      url: 'https://x.test/h',
      events: ['video.ready'],
      createdAt: '2026-03-02T00:00:00.000Z',
    };

    expect(createWebhook.result.safeParse({ ...view, secret: 'abc' }).success).toBe(true);
    expect(createWebhook.result.safeParse(view).success).toBe(false);
    expect(listWebhooks.result.parse({ items: [{ ...view, secret: 'abc' }] })).toEqual({
      items: [view],
    });
  });

  it('refuses a webhook id that is not a UUID', () => {
    expect(deleteWebhook.params.safeParse({ id: 'nope' }).success).toBe(false);
  });
});
