import entry from '../server';

vi.mock(import('@tanstack/react-start/server-entry'), () => ({
  default: { fetch: async () => new Response('the app') },
  createServerEntry: (serverEntry) => serverEntry,
}));

describe('apps/client/studio: server entry', () => {
  it('hands a request that names no built file to the app', async () => {
    const response = await entry.fetch(new Request('http://localhost/watch/abc'));

    expect(await response.text()).toBe('the app');
  });
});
