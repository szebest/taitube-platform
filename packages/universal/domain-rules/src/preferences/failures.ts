import { type Failure } from '@kit/errors';
import type { UserPreferences } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';

/** Carries what is stored, so the client can merge onto it and retry without a second read. */
export type PreferencesConflict = Failure<
  typeof ErrorCodes.VERSION_CONFLICT,
  { userId: string; current: UserPreferences | null }
>;

export function preferencesConflict(
  userId: string,
  current: UserPreferences | null
): PreferencesConflict {
  return {
    code: ErrorCodes.VERSION_CONFLICT,
    message: 'The preferences were changed by another session',
    userId,
    current,
  };
}
