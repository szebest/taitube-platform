import { canReadPreferences, canUpdatePreferences, type UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';

const CAN = { read: canReadPreferences, update: canUpdatePreferences } as const;

export interface PreferencesAccessInput {
  readonly actor: UserContext | null;
  readonly ownerId: string;
  readonly action: keyof typeof CAN;
}

export function decidePreferencesAccess({
  actor,
  ownerId,
  action,
}: PreferencesAccessInput): Result<UserContext, AuthorizationFailure> {
  return authorize(actor, CAN[action]({ user: actor, preferences: { ownerId } }), {
    action,
    subject: 'Preferences',
  });
}
