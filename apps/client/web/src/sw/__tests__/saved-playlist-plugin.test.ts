import { CACHE_NAMES } from '../cache-names';
import { savedPlaylistsFirst } from '../saved-playlist-plugin';

const request = new Request('https://cdn.test/videos/v1/hls/master.m3u8');

describe('apps/client/web: savedPlaylistsFirst', () => {
  it.each([
    { name: 'the saved playlist when one is saved', saved: new Response('saved'), expected: 'saved' },
    { name: 'the runtime cache when none is saved', saved: undefined, expected: 'runtime' },
  ])('answers a failed network with $name', async ({ saved, expected }) => {
    const match = vi.fn().mockResolvedValue(saved);
    const runtime = new Response('runtime');

    const answer = await savedPlaylistsFirst({ match }).cachedResponseWillBeUsed({
      request,
      cachedResponse: runtime,
    });

    expect(await answer?.text()).toBe(expected);
    expect(match).toHaveBeenCalledWith(request, { cacheName: CACHE_NAMES.saved });
  });
});
