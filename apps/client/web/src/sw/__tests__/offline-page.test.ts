import { OFFLINE_PAGE_URL, offlineFallback } from '../offline-page';

function failed(href: string, mode: RequestMode) {
  const request = new Request(href, { mode: mode === 'navigate' ? undefined : mode });
  Object.defineProperty(request, 'mode', { value: mode });
  return { request, url: new URL(href) };
}

describe('apps/client/web: offlineFallback', () => {
  it('serves the precached offline page for a failed page load', async () => {
    const page = new Response('offline');
    const matchPrecache = vi.fn().mockResolvedValue(page);

    const response = await offlineFallback(matchPrecache)(
      failed('https://taitube.test/watch/v1', 'navigate')
    );

    expect(response).toBe(page);
    expect(matchPrecache).toHaveBeenCalledWith(OFFLINE_PAGE_URL);
  });

  it.each([
    {
      name: 'a call to the API',
      href: 'https://taitube.test/api/v1/feed',
      mode: 'navigate' as const,
    },
    { name: 'a subresource', href: 'https://taitube.test/x.js', mode: 'cors' as const },
  ])('leaves $name a network error', async ({ href, mode }) => {
    const matchPrecache = vi.fn();

    const response = await offlineFallback(matchPrecache)(failed(href, mode));

    expect(response.type).toBe('error');
    expect(matchPrecache).not.toHaveBeenCalled();
  });

  it('is a network error when the page was never precached', async () => {
    const response = await offlineFallback(vi.fn().mockResolvedValue(undefined))(
      failed('https://taitube.test/', 'navigate')
    );

    expect(response.type).toBe('error');
  });
});
