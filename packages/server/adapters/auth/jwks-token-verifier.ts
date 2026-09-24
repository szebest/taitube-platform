import { type AuthFailure, type Principal, TokenVerifier } from '@vp/core/ports';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import { type Jwks, decodeJwt, unauthorized, verifyJwt } from './jwt';

export interface JwksTokenVerifierDeps {
  jwksUrl: string;
  issuer: string;
  audience: string;
  algorithms: readonly string[];
  cacheTtlMs: number;
  refetchIntervalMs: number;
  fetchTimeoutMs: number;
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  now: () => number;
}

function isJwks(body: unknown): body is Jwks {
  return (
    typeof body === 'object' && body !== null && Array.isArray((body as { keys?: unknown }).keys)
  );
}

/**
 * Verifies against the issuer's published keys. A kid it has not seen triggers one refetch, so a
 * rotated key is accepted at once; the refetch is rate-limited, so forged kids cannot flood the IdP.
 */
export class JwksTokenVerifier extends TokenVerifier {
  private cached: { jwks: Jwks; fetchedAt: number } | null = null;
  private lastFetchAt = Number.NEGATIVE_INFINITY;
  private pending: Promise<Result<Jwks, AuthFailure>> | null = null;

  constructor(private readonly deps: JwksTokenVerifierDeps) {
    super();
  }

  async verify(token: string): Promise<Result<Principal, AuthFailure>> {
    const decoded = decodeJwt(token);
    if (isErr(decoded)) return decoded;

    const { kid } = decoded.value.header;
    let jwks = await this.keys();
    if (isErr(jwks)) return jwks;
    if (kid !== undefined && !jwks.value.keys.some((key) => key.kid === kid)) {
      jwks = await this.refetchForUnknownKid(jwks.value);
      if (isErr(jwks)) return jwks;
    }

    return verifyJwt(decoded.value, jwks.value, this.deps);
  }

  private async keys(): Promise<Result<Jwks, AuthFailure>> {
    const { cached } = this;
    if (cached && this.deps.now() - cached.fetchedAt < this.deps.cacheTtlMs) return ok(cached.jwks);
    return this.fetchKeys();
  }

  private async refetchForUnknownKid(stale: Jwks): Promise<Result<Jwks, AuthFailure>> {
    const recently = this.deps.now() - this.lastFetchAt < this.deps.refetchIntervalMs;
    return recently ? ok(stale) : this.fetchKeys();
  }

  /** Every verify waiting on keys shares one request, so a burst of logins costs the IdP one fetch. */
  private fetchKeys(): Promise<Result<Jwks, AuthFailure>> {
    this.pending ??= this.requestKeys().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async requestKeys(): Promise<Result<Jwks, AuthFailure>> {
    this.lastFetchAt = this.deps.now();

    const response = await fromPromise(
      () =>
        this.deps.fetch(this.deps.jwksUrl, {
          signal: AbortSignal.timeout(this.deps.fetchTimeoutMs),
        }),
      () => unauthorized('the JWKS is unreachable')
    );
    if (isErr(response)) return response;
    if (!response.value.ok) return err(unauthorized(`the JWKS answered ${response.value.status}`));

    const body = await fromPromise(
      () => response.value.json() as Promise<unknown>,
      () => unauthorized('the JWKS is not JSON')
    );
    if (isErr(body)) return body;
    if (!isJwks(body.value)) return err(unauthorized('the JWKS holds no keys array'));

    this.cached = { jwks: body.value, fetchedAt: this.lastFetchAt };
    return ok(body.value);
  }
}
