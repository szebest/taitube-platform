import { getGlobalStartContext } from '@tanstack/react-start';

vi.mock(import('@tanstack/react-start'), async (importOriginal) => ({
  ...(await importOriginal()),
  getGlobalStartContext: vi.fn(),
}));

async function requestCookieDomain() {
  vi.resetModules();
  const { requestCookieDomain: read } = await import('../session-config');
  return read();
}

function outsideARequest(): never {
  throw new Error('Global context not set yet');
}

describe('@vp/queries: session config', () => {
  it('reads the cookie domain sessionMiddleware put in the request context', async () => {
    vi.mocked<() => { sessionCookieDomain?: string } | undefined>(
      getGlobalStartContext
    ).mockReturnValue({ sessionCookieDomain: 'taitube.example' });

    expect(await requestCookieDomain()).toBe('taitube.example');
  });

  it.each([
    { scenario: 'on the client, which has no request context', context: () => undefined },
    { scenario: 'outside a request, as in a spec', context: outsideARequest },
  ])('has none $scenario', async ({ context }) => {
    vi.mocked(getGlobalStartContext).mockImplementation(context);

    expect(await requestCookieDomain()).toBeUndefined();
  });
});
