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
 * rotating addresses beats the limit. The budget is read before the password is hashed, so a
 * locked caller costs the server no scrypt.
 */
export async function checkPassword(
  { gate, hasher, config }: Pick<WatchPartyDeps, 'gate' | 'hasher' | 'config'>,
  { roomId, memberKey, ip, passwordHash, password }: PasswordAttempt
): Promise<Result<JoinPassword, PasswordFailure>> {
  const rule = config.budgets.password;
  const [byMember, byAddress] = [`${roomId}:${memberKey}`, `${roomId}:${ip}`];

  const checks = all(
    await Promise.all([byMember, byAddress].map((scope) => gate.check('password', scope, rule)))
  );
  if (isErr(checks)) return checks;
  const refusals = checks.value.flatMap((admission) =>
    admission.type === 'refused' ? [admission.retryAfterSeconds] : []
  );
  if (refusals.length > 0) return err(watchPartyPasswordLocked(Math.max(...refusals)));

  const verified = await hasher.verify(password, passwordHash);
  if (isErr(verified)) return verified;

  if (verified.value) {
    const cleared = await gate.reset('password', byMember);
    return isErr(cleared) ? cleared : ok('valid');
  }
  const counted = all(
    await Promise.all([byMember, byAddress].map((scope) => gate.consume('password', scope, rule)))
  );
  return isErr(counted) ? counted : ok('invalid');
}
