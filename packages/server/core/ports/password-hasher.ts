import type { ErrorCodes, Failure } from '@vp/errors';
import type { Result } from '@vp/result';

export type HashingFailed = Failure<
  typeof ErrorCodes.INTERNAL,
  { operation: string; cause?: unknown }
>;

/** Slow, salted, self-describing password hashes, compared in constant time. */
export interface PasswordHasherPort {
  hash(password: string): Promise<Result<string, HashingFailed>>;
  /** `false` for a wrong password and for a hash this hasher cannot read. */
  verify(password: string, encoded: string): Promise<Result<boolean, HashingFailed>>;
}
