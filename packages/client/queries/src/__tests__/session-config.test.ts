import { getGlobalStartContext } from '@tanstack/react-start';

vi.mock(import('@tanstack/react-start'), async (importOriginal) => ({
  ...(await importOriginal()),
  getGlobalStartContext: vi.fn(),
}));

async function readFromRequest() {
  vi.resetModules();
  const config = await import('../session-config');
  return config.requestSession();
}

function outsideARequest(): never {
  throw new Error('Global context not set yet');
}

describe('@vp/queries: session config', () => {
  it('reads what sessionMiddleware put in the request context', async () => {
    const session = {
      apiBaseUrl: 'http://api:3000',
      cookieDomain: 'taitube.example',
      devTokenUrl: 'http://dev-token:3002',
      accountsMax: 3,
    };
    vi.mocked<() => { session: typeof session } | undefined>(getGlobalStartContext).mockReturnValue(
      { session }
    );

    expect(await readFromRequest()).toEqual(session);
  });

  it.each([
    { scenario: 'on the client, which has no request context', context: () => undefined },
    { scenario: 'outside a request, as in a spec', context: outsideARequest },
  ])('has the defaults $scenario', async ({ context }) => {
    vi.mocked(getGlobalStartContext).mockImplementation(context);

    expect(await readFromRequest()).toEqual({
      apiBaseUrl: undefined,
      cookieDomain: undefined,
      devTokenUrl: undefined,
      accountsMax: 10,
    });
  });
});
