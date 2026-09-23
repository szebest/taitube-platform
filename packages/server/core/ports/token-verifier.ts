import type { ErrorCodes, Failure } from '@vp/errors';
import type { Result } from '@vp/result';

/** The verified claims of a bearer token: who it names, and the role its issuer vouches for. */
export interface Principal {
  readonly sub: string;
  readonly role: string | undefined;
  readonly email: string | undefined;
}

export type AuthFailure = Failure<typeof ErrorCodes.UNAUTHORIZED, { reason: string }>;

export abstract class TokenVerifier {
  abstract verify(token: string): Promise<Result<Principal, AuthFailure>>;
}
