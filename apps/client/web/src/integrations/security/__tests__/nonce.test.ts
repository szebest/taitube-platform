import { createNonce } from '../nonce';

describe('apps/client/web: nonce', () => {
  it('makes a fresh base64 nonce of 128 bits for every request', () => {
    const first = createNonce();

    expect(atob(first)).toHaveLength(16);
    expect(createNonce()).not.toBe(first);
  });
});
