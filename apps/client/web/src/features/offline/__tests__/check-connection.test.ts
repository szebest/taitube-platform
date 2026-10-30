import { connectionIsBack } from '../check-connection';

describe('apps/client/web: connectionIsBack', () => {
  it.each([
    {
      name: 'a server that answers',
      fetch: async () => new Response(null, { status: 200 }),
      back: true,
    },
    {
      name: 'a server that answers with an error',
      fetch: async () => new Response(null, { status: 503 }),
      back: false,
    },
    {
      name: 'a network that is gone',
      fetch: async () => Promise.reject(new TypeError('offline')),
      back: false,
    },
  ])('finds $name is back: $back', async ({ fetch, back }) => {
    vi.stubGlobal('fetch', vi.fn(fetch));

    await expect(connectionIsBack()).resolves.toBe(back);
    expect(fetch).toBeDefined();
  });

  it('asks without the cache', async () => {
    const probe = vi.fn(async () => new Response(null));
    vi.stubGlobal('fetch', probe);

    await connectionIsBack();

    expect(probe).toHaveBeenCalledWith('/robots.txt', { method: 'HEAD', cache: 'no-store' });
  });
});
