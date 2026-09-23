import { signJwt, signingKey } from '@vp/testing/jwt';
import { expectErr, expectOk } from '@vp/testing/result';
import type { Jwk } from '../jwt';
import { JwksTokenVerifier } from '../jwks-token-verifier';

const JWKS_URL = 'https://idp.example/.well-known/jwks.json';
const CACHE_TTL_MS = 300_000;
const REFETCH_INTERVAL_MS = 30_000;

function claims(now: number) {
  const iat = Math.floor(now / 1000);
  return { sub: 'user-1', iss: 'https://idp.example/', aud: 'taitube', iat, exp: iat + 600 };
}

function harness() {
  const clock = { now: 1_000_000 };
  const published: { keys: Jwk[] } = { keys: [] };
  const fetch = vi.fn(async () => Response.json(published));
  const verifier = new JwksTokenVerifier({
    jwksUrl: JWKS_URL,
    issuer: 'https://idp.example/',
    audience: 'taitube',
    algorithms: ['RS256', 'ES256'],
    cacheTtlMs: CACHE_TTL_MS,
    refetchIntervalMs: REFETCH_INTERVAL_MS,
    fetch,
    now: () => clock.now,
  });
  return { clock, published, fetch, verifier };
}

describe('packages/adapters/auth: JwksTokenVerifier', () => {
  it('verifies a token against the published key and caches the key set', async () => {
    const { clock, published, fetch, verifier } = harness();
    const key = signingKey('RS256', 'k1');
    published.keys = [key.jwk];

    expectOk(await verifier.verify(signJwt(key, claims(clock.now))));
    expectOk(await verifier.verify(signJwt(key, claims(clock.now))));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(JWKS_URL);
  });

  it('accepts a rotated key on the first token that names it, before the cache expires', async () => {
    const { clock, published, fetch, verifier } = harness();
    const first = signingKey('RS256', 'k1');
    published.keys = [first.jwk];
    expectOk(await verifier.verify(signJwt(first, claims(clock.now))));

    const rotated = signingKey('ES256', 'k2');
    published.keys = [first.jwk, rotated.jwk];
    clock.now += REFETCH_INTERVAL_MS;

    expectOk(await verifier.verify(signJwt(rotated, claims(clock.now))));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches for an unknown kid at most once per interval', async () => {
    const { clock, published, fetch, verifier } = harness();
    const known = signingKey('RS256', 'k1');
    const forged = signingKey('RS256', 'forged');
    published.keys = [known.jwk];
    expectOk(await verifier.verify(signJwt(known, claims(clock.now))));

    clock.now += REFETCH_INTERVAL_MS;
    expectErr(await verifier.verify(signJwt(forged, claims(clock.now))));
    clock.now += REFETCH_INTERVAL_MS - 1;
    expectErr(await verifier.verify(signJwt(forged, claims(clock.now))));
    expect(fetch).toHaveBeenCalledTimes(2);

    clock.now += 1;
    expectErr(await verifier.verify(signJwt(forged, claims(clock.now))));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('fetches the key set again once the cache expires', async () => {
    const { clock, published, fetch, verifier } = harness();
    const key = signingKey('RS256', 'k1');
    published.keys = [key.jwk];
    expectOk(await verifier.verify(signJwt(key, claims(clock.now))));

    clock.now += CACHE_TTL_MS;
    expectOk(await verifier.verify(signJwt(key, claims(clock.now))));

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { scenario: 'is unreachable', respond: () => Promise.reject(new Error('ECONNREFUSED')) },
    { scenario: 'answers 500', respond: async () => new Response('down', { status: 500 }) },
    { scenario: 'answers something other than a key set', respond: async () => Response.json({}) },
  ])('refuses every token when the JWKS $scenario', async ({ respond }) => {
    const { clock, fetch, verifier } = harness();
    fetch.mockImplementation(respond);

    const refused = expectErr(
      await verifier.verify(signJwt(signingKey('RS256', 'k1'), claims(clock.now)))
    );

    expect(refused.code).toBe('UNAUTHORIZED');
  });
});
