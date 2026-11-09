import { getGlobalStartContext } from '@tanstack/react-start';

vi.mock(import('@tanstack/react-start'), async (importOriginal) => ({
  ...(await importOriginal()),
  getGlobalStartContext: vi.fn(),
}));

async function readFromRequest(key: 'requestCookieDomain' | 'requestDevTokenUrl') {
  vi.resetModules();
  const config = await import('../session-config');
  return config[key]();
}

function outsideARequest(): never {
  throw new Error('Global context not set yet');
}

describe('@vp/queries: session config', () => {
  it.each([
    { read: 'requestCookieDomain' as const, expected: 'taitube.example' },
    { read: 'requestDevTokenUrl' as const, expected: 'http://dev-token:3002' },
  ])(
    'reads what sessionMiddleware put in the request context: $read',
    async ({ read, expected }) => {
      vi.mocked<() => { sessionCookieDomain?: string; devTokenUrl?: string } | undefined>(
        getGlobalStartContext
      ).mockReturnValue({
        sessionCookieDomain: 'taitube.example',
        devTokenUrl: 'http://dev-token:3002',
      });

      expect(await readFromRequest(read)).toBe(expected);
    }
  );

  it.each([
    { scenario: 'on the client, which has no request context', context: () => undefined },
    { scenario: 'outside a request, as in a spec', context: outsideARequest },
  ])('has none $scenario', async ({ context }) => {
    vi.mocked(getGlobalStartContext).mockImplementation(context);

    expect(await readFromRequest('requestCookieDomain')).toBeUndefined();
    expect(await readFromRequest('requestDevTokenUrl')).toBeUndefined();
  });
});
