import { getGlobalStartContext } from '@tanstack/react-start';
import { requestNonce } from '../request-nonce';

vi.mock(import('@tanstack/react-start'), async (importOriginal) => ({
  ...(await importOriginal()),
  getGlobalStartContext: vi.fn(),
}));

function outsideARequest(): never {
  throw new Error('Global context not set yet');
}

describe('apps/web: request nonce', () => {
  it('reads the nonce the request middleware made', () => {
    vi.mocked(getGlobalStartContext).mockReturnValue({ nonce: 'abc' });

    expect(requestNonce()).toBe('abc');
  });

  it.each([
    { scenario: 'on the client, which has no request context', context: () => undefined },
    { scenario: 'outside a request, as in a spec', context: outsideARequest },
  ])('has none $scenario', ({ context }) => {
    vi.mocked(getGlobalStartContext).mockImplementation(context);

    expect(requestNonce()).toBeUndefined();
  });
});
