import { createHash } from 'node:crypto';
import { formatApiToken, parseApiToken } from '@vp/domain';
import { nodeApiTokenSecrets } from '../api-token-secrets';

describe('apps/server/api/composition: api token secrets', () => {
  it('mints a prefix and a secret that make a well formed token, fresh each time', () => {
    const first = nodeApiTokenSecrets.mint();
    const second = nodeApiTokenSecrets.mint();

    expect(parseApiToken(formatApiToken(first))).toEqual(first);
    expect(second).not.toEqual(first);
  });

  it('keeps the SHA-256 of the 32 secret bytes', () => {
    const { secret } = nodeApiTokenSecrets.mint();

    expect(nodeApiTokenSecrets.hash(secret)).toBe(
      createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex')
    );
  });

  it.each([
    { scenario: 'its own hash', other: false, garbled: false, matches: true },
    { scenario: "another secret's hash", other: true, garbled: false, matches: false },
    { scenario: 'a hash of the wrong length', other: false, garbled: true, matches: false },
  ])('matches a secret against $scenario: $matches', ({ other, garbled, matches }) => {
    const { secret } = nodeApiTokenSecrets.mint();
    const stored = nodeApiTokenSecrets.hash(other ? nodeApiTokenSecrets.mint().secret : secret);

    expect(nodeApiTokenSecrets.matches(secret, garbled ? stored.slice(2) : stored)).toBe(matches);
  });
});
