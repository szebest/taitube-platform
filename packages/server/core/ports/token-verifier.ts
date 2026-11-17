import type { Result } from '@kit/result';
import type { ErrorCodes, Failure } from '@vp/errors';

export interface Principal {
  readonly sub: string;
  readonly role: string | undefined;
  readonly email: string | undefined;
}

export type AuthFailure = Failure<typeof ErrorCodes.UNAUTHORIZED, { reason: string }>;

export abstract class TokenVerifier {
  abstract verify(token: string): Promise<Result<Principal, AuthFailure>>;
}
