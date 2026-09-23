import { type AuthFailure, type Principal, TokenVerifier } from '@vp/core/ports';
import { type Result, isErr } from '@vp/result';
import { type Jwks, decodeJwt, verifyJwt } from './jwt';

export interface DevTokenVerifierDeps {
  jwks: Jwks;
  issuer: string;
  audience: string;
  now: () => number;
}

const DEV_ALGORITHMS = ['EdDSA'] as const;

/** Verifies `pnpm dev-token` tokens. Their key is derived from a committed seed: dev mode only. */
export class DevTokenVerifier extends TokenVerifier {
  constructor(private readonly deps: DevTokenVerifierDeps) {
    super();
  }

  async verify(token: string): Promise<Result<Principal, AuthFailure>> {
    const decoded = decodeJwt(token);
    if (isErr(decoded)) return decoded;

    return verifyJwt(decoded.value, this.deps.jwks, { ...this.deps, algorithms: DEV_ALGORITHMS });
  }
}
