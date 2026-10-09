import { getGlobalStartContext } from '@tanstack/react-start';

vi.mock(import('@tanstack/react-start'), async (importOriginal) => ({
  ...(await importOriginal()),
  getGlobalStartContext: vi.fn(),
}));

async function requestNonce() {
  vi.resetModules();
  const { requestNonce: read } = await import('../request-nonce');
  return read();
}

function outsideARequest(): never {
  throw new Error('Global context not set yet');
}

describe('apps/client/web: request nonce', () => {
  it('reads the nonce the request middleware made', async () => {
    vi.mocked(getGlobalStartContext).mockReturnValue({ nonce: 'abc' });

    expect(await requestNonce()).toBe('abc');
  });

  it.each([
    { scenario: 'on the client, which has no request context', context: () => undefined },
    { scenario: 'outside a request, as in a spec', context: outsideARequest },
  ])('has none $scenario', async ({ context }) => {
    vi.mocked(getGlobalStartContext).mockImplementation(context);

    expect(await requestNonce()).toBeUndefined();
  });
});
