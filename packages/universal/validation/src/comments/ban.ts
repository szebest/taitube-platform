import { type Result, err, ok } from '@vp/result';
import { normalizePlainText, withinLength } from '../plain-text';
import { type InvalidRestriction, invalidRestriction } from './failures';

const MAX_REASON_LENGTH = 200;

export interface BanInput {
  readonly reason?: string | null;
  readonly expiresAt?: Date | null;
}

export interface ValidBan {
  readonly reason: string | null;
  readonly expiresAt: Date | null;
}

/** A ban ends in the future or never; its reason is plain text a banned user may read. */
export function validateBan(input: BanInput, now: Date): Result<ValidBan, InvalidRestriction> {
  const reason = normalizePlainText(input.reason ?? '') || null;
  if (reason !== null && !withinLength(reason, { minLength: 1, maxLength: MAX_REASON_LENGTH })) {
    return err(
      invalidRestriction('reason', `Use at most ${MAX_REASON_LENGTH} characters`, {
        max: MAX_REASON_LENGTH,
      })
    );
  }

  const expiresAt = input.expiresAt ?? null;
  if (expiresAt !== null && !(expiresAt > now)) {
    return err(invalidRestriction('expiresAt', 'A ban has to end in the future, or never', {}));
  }
  return ok({ reason, expiresAt });
}
