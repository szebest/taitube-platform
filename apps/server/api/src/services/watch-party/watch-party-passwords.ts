import type { HashingFailed } from '@vp/core/ports';
import type { JoinPassword } from '@vp/domain-rules';
import {
  type CacheUnavailable,
  type WatchPartyPasswordLocked,
  watchPartyPasswordLocked,
} from '@vp/errors';
import { all, err, isErr, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';

export interface PasswordAttempt {
  readonly roomId: string;
  readonly memberKey: string;
  readonly ip: string;
  readonly passwordHash: string;
  readonly password: string;
}

type PasswordFailure = WatchPartyPasswordLocked | HashingFailed | CacheUnavailable;

/**
 * One member key and one address each get their own count per room, so neither rotating keys nor
 * rotating addresses beats the limit. The attempt is counted before the password is hashed, in one
 * atomic step, so parallel guesses cannot all slip under the limit and a locked caller costs the
 * server no scrypt. The right password clears the member key and gives the address its attempt back.
 */
export async function checkPassword(
  { gate, hasher, config }: Pick<WatchPartyDeps, 'gate' | 'hasher' | 'config'>,
  { roomId, memberKey, ip, passwordHash, password }: PasswordAttempt
): Promise<Result<JoinPassword, PasswordFailure>> {
  const rule = config.budgets.password;
  const [byMember, byAddress] = [`${roomId}:${memberKey}`, `${roomId}:${ip}`];

  const charges = all(
    await Promise.all([byMember, byAddress].map((scope) => gate.consume('password', scope, rule)))
  );
  if (isErr(charges)) return charges;
  const refusals = charges.value.flatMap((admission) =>
    admission.type === 'refused' ? [admission.retryAfterSeconds] : []
  );
  if (refusals.length > 0) return err(watchPartyPasswordLocked(Math.max(...refusals)));

  const verified = await hasher.verify(password, passwordHash);
  if (isErr(verified)) return verified;
  if (!verified.value) return ok('invalid');

  const cleared = all(
    await Promise.all([gate.reset('password', byMember), gate.release('password', byAddress)])
  );
  return isErr(cleared) ? cleared : ok('valid');
}
